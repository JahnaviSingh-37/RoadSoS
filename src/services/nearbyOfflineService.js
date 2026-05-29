import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import * as TaskManager from 'expo-task-manager';

import { offlineCache } from '@/utils/offlineCache';

const NEARBY_REFRESH_TASK = 'roadsos-nearby-nightly-refresh';
const HOME_LOCATION_KEY = 'offline_home_location';
const LAST_CACHE_KEY_POINTER = 'offline_services_last_cache_key';
const RESULTS_PER_CATEGORY = 10;
const RADIUS_METERS = 50_000;

const CATEGORY_CONFIG = {
  Hospital: { type: 'hospital', color: '#E24B4A' },
  Police: { type: 'police', color: '#2563EB' },
  Fire: { type: 'fire_station', color: '#F59E0B' },
};

function toCacheCoordPart(value) {
  return Number(value).toFixed(3);
}

function buildCacheKey(lat, lng) {
  return `offline_services_${toCacheCoordPart(lat)}_${toCacheCoordPart(lng)}`;
}

async function fetchPlaceDetails(placeId, apiKey) {
  const detailsUrl =
    `https://maps.googleapis.com/maps/api/place/details/json?` +
    `place_id=${encodeURIComponent(placeId)}&fields=formatted_phone_number,international_phone_number&key=${apiKey}`;

  const response = await fetch(detailsUrl);
  const payload = await response.json();

  if (payload.status !== 'OK' || !payload.result) {
    return { phone: null };
  }

  return {
    phone: payload.result.international_phone_number ?? payload.result.formatted_phone_number ?? null,
  };
}

async function fetchCategoryServices(homeLocation, categoryName, apiKey) {
  const category = CATEGORY_CONFIG[categoryName];
  const nearbyUrl =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
    `location=${homeLocation.latitude},${homeLocation.longitude}&radius=${RADIUS_METERS}` +
    `&type=${category.type}&key=${apiKey}`;

  const response = await fetch(nearbyUrl);
  const payload = await response.json();

  if (payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
    throw new Error(`${categoryName} lookup failed: ${payload.status}`);
  }

  const topResults = (payload.results ?? []).slice(0, RESULTS_PER_CATEGORY);
  const items = await Promise.all(
    topResults.map(async (place) => {
      const details = await fetchPlaceDetails(place.place_id, apiKey);

      return {
        id: `${categoryName}-${place.place_id}`,
        name: place.name,
        address: place.vicinity ?? 'Address unavailable',
        phone: details.phone,
        coordinates: {
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
        },
        category: categoryName,
        markerColor: category.color,
      };
    })
  );

  return items;
}

export async function getStoredHomeLocation() {
  return offlineCache.get(HOME_LOCATION_KEY);
}

export async function saveHomeLocation(location) {
  const payload = {
    latitude: location.latitude,
    longitude: location.longitude,
  };

  await offlineCache.set(HOME_LOCATION_KEY, payload);
  return payload;
}

export async function ensureHomeLocation(currentLocation) {
  const existing = await getStoredHomeLocation();
  if (existing?.latitude && existing?.longitude) {
    return existing;
  }

  if (currentLocation?.latitude && currentLocation?.longitude) {
    return saveHomeLocation(currentLocation);
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return saveHomeLocation({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });
}

export async function fetchAndCacheNearbyForHome(homeLocation, apiKey) {
  if (!apiKey) {
    // Do not throw here - allow app to function without a Google Maps key
    // (useful for local dev or users who don't want to provide a key).
    // Upstream callers may still attempt a fetch, so return null to indicate
    // that no offline cache was created.
    // eslint-disable-next-line no-console
    console.warn('Skipping nearby fetch: missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.');
    return null;
  }

  const categoryKeys = ['Hospital', 'Police', 'Fire'];
  const resultSets = await Promise.all(
    categoryKeys.map((category) => fetchCategoryServices(homeLocation, category, apiKey))
  );

  const cacheKey = buildCacheKey(homeLocation.latitude, homeLocation.longitude);
  const payload = {
    syncedAt: Date.now(),
    homeLocation,
    radiusMeters: RADIUS_METERS,
    services: resultSets.flat(),
  };

  await offlineCache.set(cacheKey, payload);
  await offlineCache.set(LAST_CACHE_KEY_POINTER, { key: cacheKey });

  return {
    cacheKey,
    ...payload,
  };
}

export async function loadCachedNearbyByHome(homeLocation) {
  const exactKey = buildCacheKey(homeLocation.latitude, homeLocation.longitude);
  const exact = await offlineCache.get(exactKey);
  if (exact?.services) {
    return {
      cacheKey: exactKey,
      ...exact,
    };
  }

  const pointer = await offlineCache.get(LAST_CACHE_KEY_POINTER);
  if (!pointer?.key) {
    return null;
  }

  const fallback = await offlineCache.get(pointer.key);
  if (!fallback?.services) {
    return null;
  }

  return {
    cacheKey: pointer.key,
    ...fallback,
  };
}

export async function isNetworkAvailable() {
  const networkState = await Network.getNetworkStateAsync();
  return Boolean(networkState.isConnected) && networkState.isInternetReachable !== false;
}

if (!TaskManager.isTaskDefined(NEARBY_REFRESH_TASK)) {
  TaskManager.defineTask(NEARBY_REFRESH_TASK, async () => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      const online = await isNetworkAvailable();
      if (!online) {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      const homeLocation = await getStoredHomeLocation();
      if (!homeLocation) {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      await fetchAndCacheNearbyForHome(homeLocation, apiKey);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export async function registerNightlyNearbyRefreshTask() {
  const status = await BackgroundFetch.getStatusAsync();
  if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
    return false;
  }

  const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(NEARBY_REFRESH_TASK);
  if (alreadyRegistered) {
    return true;
  }

  await BackgroundFetch.registerTaskAsync(NEARBY_REFRESH_TASK, {
    minimumInterval: 60 * 60 * 24,
    stopOnTerminate: false,
    startOnBoot: true,
  });

  return true;
}

export const nearbyOfflineService = {
  ensureHomeLocation,
  fetchAndCacheNearbyForHome,
  loadCachedNearbyByHome,
  isNetworkAvailable,
  registerNightlyNearbyRefreshTask,
};
