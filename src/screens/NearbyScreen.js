import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    Vibration,
    View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { useAppContext } from '@/context/AppContext';
import { generateMockNearbyServices } from '@/data/mockNearbyServices';
import {
    buildHospitalIntelligence,
    buildMapsDirectionsUrl,
    getBloodMatchedHospitals,
    selectBestHospital,
} from '@/services/hospitalIntelligence';
import { nearbyOfflineService } from '@/services/nearbyOfflineService';
import {
    buildSafeRouteUrl,
    calculateRoadRisk,
    getRiskLevelColor,
    getRiskOverlayHotspots,
    selectNearestSafeDestination,
} from '@/services/RiskEngine';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const RESULTS_PER_CATEGORY = 10;
const FALLBACK_LOCATION = { latitude: 26.8467, longitude: 80.9462 };

const FILTER_OPTIONS = ['All', 'Hospital', 'Police', 'Fire'];

const CATEGORY_CONFIG = {
  Hospital: { type: 'hospital', color: '#E24B4A' },
  Police: { type: 'police', color: '#2563EB' },
  Fire: { type: 'fire_station', color: '#F59E0B' },
};

function haversineDistanceKm(a, b) {
  const earthRadiusKm = 6371;
  const latDelta = ((b.latitude - a.latitude) * Math.PI) / 180;
  const lonDelta = ((b.longitude - a.longitude) * Math.PI) / 180;

  const startLat = (a.latitude * Math.PI) / 180;
  const endLat = (b.latitude * Math.PI) / 180;

  const h =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function formatOpenStatus(isOpen) {
  if (isOpen === true) {
    return 'Open now';
  }
  if (isOpen === false) {
    return 'Closed';
  }
  return 'Status unavailable';
}

function mapFilterToCategory(filter) {
  if (filter === 'All') {
    return null;
  }
  return filter;
}

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={[styles.skeletonLine, { width: '62%' }]} />
      <View style={[styles.skeletonLine, { width: '35%' }]} />
      <View style={[styles.skeletonLine, { width: '48%' }]} />
      <View style={[styles.skeletonLine, { width: '55%' }]} />
    </View>
  );
}

async function fetchPlaceDetails(placeId) {
  const detailsUrl =
    `https://maps.googleapis.com/maps/api/place/details/json?` +
    `place_id=${encodeURIComponent(placeId)}&fields=formatted_phone_number,international_phone_number,opening_hours&key=${GOOGLE_PLACES_API_KEY}`;

  const response = await fetch(detailsUrl);
  const payload = await response.json();

  if (payload.status !== 'OK' || !payload.result) {
    return {
      phoneNumber: null,
      openNow: null,
    };
  }

  return {
    phoneNumber: payload.result.international_phone_number ?? payload.result.formatted_phone_number ?? null,
    openNow: payload.result.opening_hours?.open_now ?? null,
  };
}

async function fetchCategoryPlaces(location, categoryName) {
  const category = CATEGORY_CONFIG[categoryName];
  const { latitude, longitude } = location;

  const nearbyUrl =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
    `location=${latitude},${longitude}&radius=10000&type=${category.type}&key=${GOOGLE_PLACES_API_KEY}`;

  const response = await fetch(nearbyUrl);
  const payload = await response.json();

  if (payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
    throw new Error(`${categoryName} lookup failed: ${payload.status}`);
  }

  const topResults = (payload.results ?? []).slice(0, RESULTS_PER_CATEGORY);

  const enriched = await Promise.all(
    topResults.map(async (place) => {
      const details = await fetchPlaceDetails(place.place_id);

      const placeLocation = {
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
      };

      const distanceKm = haversineDistanceKm(location, placeLocation);

      return {
        id: `${categoryName}-${place.place_id}`,
        category: categoryName,
        markerColor: category.color,
        name: place.name,
        distanceKm,
        latitude: placeLocation.latitude,
        longitude: placeLocation.longitude,
        openNow: details.openNow ?? place.opening_hours?.open_now ?? null,
        phoneNumber: details.phoneNumber,
        vicinity: place.vicinity ?? 'Address unavailable',
      };
    })
  );

  return enriched;
}

function normalizeCachedServices(currentLocation, cachedServices) {
  return cachedServices.map((item) => {
    const placeLocation = {
      latitude: item.coordinates.latitude,
      longitude: item.coordinates.longitude,
    };

    return {
      id: item.id,
      category: item.category,
      markerColor: item.markerColor ?? CATEGORY_CONFIG[item.category]?.color ?? '#6B7280',
      name: item.name,
      distanceKm: haversineDistanceKm(currentLocation, placeLocation),
      latitude: placeLocation.latitude,
      longitude: placeLocation.longitude,
      openNow: null,
      phoneNumber: item.phone,
      vicinity: item.address,
    };
  });
}

function formatRiskLevel(score) {
  if (score >= 8.5) return 'DANGER';
  if (score >= 6.5) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  return 'LOW';
}

function interpolateRoadRiskColor(level) {
  return getRiskLevelColor(level);
}

function projectHotspotToOverlay(location, hotspot, span = 0.12) {
  if (!location || !hotspot) return { left: 50, top: 50 };

  const lngDelta = hotspot.geometry.coordinates[0] - location.longitude;
  const latDelta = hotspot.geometry.coordinates[1] - location.latitude;
  const left = 50 + (lngDelta / span) * 42;
  const top = 50 - (latDelta / span) * 42;

  return {
    left: Math.max(2, Math.min(96, left)),
    top: Math.max(2, Math.min(96, top)),
  };
}

export default function NearbyScreen() {
  const router = useRouter();
  const { currentLocation: sharedLocation, setCurrentLocation: setSharedLocation, latestTriageReport, profile, demoFlowStep, setDemoFlowStep } = useAppContext();
  const [currentLocation, setCurrentLocation] = useState(sharedLocation ?? null);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [riskState, setRiskState] = useState(null);
  const [riskWeatherReady, setRiskWeatherReady] = useState(false);
  const [riskNotificationArmed, setRiskNotificationArmed] = useState(true);
  const [displayRiskScore, setDisplayRiskScore] = useState(0);
  const [journeyDestination, setJourneyDestination] = useState('');
  const [journeyActive, setJourneyActive] = useState(false);
  const [journeySummary, setJourneySummary] = useState(null);
  const [journeyAlerts, setJourneyAlerts] = useState(0);
  const [bloodGroupFilter, setBloodGroupFilter] = useState(profile?.bloodGroup ?? 'B+');
  const journeyTimerRef = useRef(null);
  const journeyStartRef = useRef(null);
  const lastJourneyRiskRef = useRef(null);
  const lastRiskLevelRef = useRef(null);
  const watchSubscriptionRef = useRef(null);

  useEffect(() => {
    if (sharedLocation) {
      setCurrentLocation(sharedLocation);
    }
  }, [sharedLocation]);

  useEffect(() => {
    if (demoFlowStep !== 'hospital') return undefined;

    const timer = setTimeout(() => {
      setDemoFlowStep('incident');
      router.push('/incident-report');
    }, 2000);

    return () => clearTimeout(timer);
  }, [demoFlowStep, router, setDemoFlowStep]);

  useEffect(() => {
    let mounted = true;

    async function refreshRisk(location) {
      if (!location) return;

      try {
        const nextRisk = await calculateRoadRisk(location);
        if (!mounted) return;

        setRiskState(nextRisk);
        setRiskWeatherReady(true);

        const shouldAlert = nextRisk.shouldHeadsUp && nextRisk.riskLevel !== lastRiskLevelRef.current && riskNotificationArmed;
        if (shouldAlert) {
          const message = nextRisk.alerts?.[0] ?? 'High-risk road conditions ahead.';

          if (Platform.OS === 'web' && typeof window !== 'undefined' && window.Notification) {
            if (window.Notification.permission === 'granted') {
              new window.Notification('ROADSoS heads up', { body: message });
            } else if (window.Notification.permission === 'default') {
              window.Notification.requestPermission().then((permission) => {
                if (permission === 'granted') {
                  new window.Notification('ROADSoS heads up', { body: message });
                }
              });
            }
          }

          Alert.alert('Heads up', message);
          setRiskNotificationArmed(false);
        }

        if (!nextRisk.shouldHeadsUp) {
          setRiskNotificationArmed(true);
        }

        lastRiskLevelRef.current = nextRisk.riskLevel;
      } catch {
        if (mounted) {
          setRiskWeatherReady(false);
        }
      }
    }

    async function loadNearby() {
      setLoading(true);
      setFetchError(null);

      try {
        if (Platform.OS === 'web') {
          const fallbackLocation = currentLocation || FALLBACK_LOCATION;
          setCurrentLocation(fallbackLocation);
          setSharedLocation({ ...fallbackLocation, address: 'Lucknow, India', label: 'Lucknow, India' });
          setOfflineMode(true);
          setPlaces(generateMockNearbyServices(fallbackLocation));
          void refreshRisk(fallbackLocation);
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          const fallbackLocation = FALLBACK_LOCATION;
          setCurrentLocation(fallbackLocation);
          setSharedLocation({ ...fallbackLocation, address: 'Lucknow, India', label: 'Lucknow, India' });
          setOfflineMode(true);
          setPlaces(generateMockNearbyServices(fallbackLocation));
          void refreshRisk(fallbackLocation);
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setCurrentLocation(location);
  setSharedLocation({ ...location, address: 'Lucknow, India', label: 'Lucknow, India' });
        void refreshRisk(location);

        if (watchSubscriptionRef.current) {
          watchSubscriptionRef.current.remove();
        }

        watchSubscriptionRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 80 },
          (nextPosition) => {
            const nextLocation = {
              latitude: nextPosition.coords.latitude,
              longitude: nextPosition.coords.longitude,
            };

            setCurrentLocation(nextLocation);
            void refreshRisk(nextLocation);
          }
        );

        const homeLocation = await nearbyOfflineService.ensureHomeLocation(location);
        await nearbyOfflineService.registerNightlyNearbyRefreshTask();

        const online = await nearbyOfflineService.isNetworkAvailable();

        if (!online) {
          const cached = await nearbyOfflineService.loadCachedNearbyByHome(homeLocation);
          if (!cached?.services) {
            throw new Error('Offline and no cached services available yet.');
          }

          if (!mounted) {
            return;
          }

          setOfflineMode(true);
          setLastSyncedAt(cached.syncedAt ?? null);
          setPlaces(normalizeCachedServices(location, cached.services));
          return;
        }

        if (!GOOGLE_PLACES_API_KEY) {
          setOfflineMode(true);
          setPlaces(generateMockNearbyServices(location));
          void refreshRisk(location);
          return;
        }

        const categoryKeys = ['Hospital', 'Police', 'Fire'];
        const results = await Promise.all(
          categoryKeys.map((categoryName) => fetchCategoryPlaces(location, categoryName))
        );

        if (!mounted) {
          return;
        }

        setOfflineMode(false);
        setPlaces(results.flat());

        const cached = await nearbyOfflineService.fetchAndCacheNearbyForHome(
          homeLocation,
          GOOGLE_PLACES_API_KEY
        );

        if (!mounted) {
          return;
        }

        setLastSyncedAt(cached.syncedAt ?? null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        try {
          const homeLocation = await nearbyOfflineService.ensureHomeLocation();
          const cached = await nearbyOfflineService.loadCachedNearbyByHome(homeLocation);

          if (cached?.services) {
            setOfflineMode(true);
            setLastSyncedAt(cached.syncedAt ?? null);

            if (currentLocation) {
              setPlaces(normalizeCachedServices(currentLocation, cached.services));
            } else {
              setCurrentLocation(homeLocation);
              setSharedLocation({ ...homeLocation, address: 'Lucknow, India', label: 'Lucknow, India' });
              setPlaces(normalizeCachedServices(homeLocation, cached.services));
            }
          } else {
            const fallbackLocation = currentLocation || homeLocation || FALLBACK_LOCATION;
            setCurrentLocation(fallbackLocation);
            setSharedLocation({ ...fallbackLocation, address: 'Lucknow, India', label: 'Lucknow, India' });
            setOfflineMode(true);
            setPlaces(generateMockNearbyServices(fallbackLocation));
            void refreshRisk(fallbackLocation);
          }
        } catch {
          const fallbackLocation = currentLocation || FALLBACK_LOCATION;
          setCurrentLocation(fallbackLocation);
          setSharedLocation({ ...fallbackLocation, address: 'Lucknow, India', label: 'Lucknow, India' });
          setOfflineMode(true);
          setPlaces(generateMockNearbyServices(fallbackLocation));
          void refreshRisk(fallbackLocation);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadNearby();

    return () => {
      mounted = false;
      if (journeyTimerRef.current) {
        clearInterval(journeyTimerRef.current);
      }
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    const target = riskState?.riskScore ?? 0;
    const start = 0;
    const steps = 18;
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep += 1;
      const value = start + ((target - start) * currentStep) / steps;
      setDisplayRiskScore(Number(value.toFixed(1)));
      if (currentStep >= steps) {
        clearInterval(timer);
      }
    }, 35);

    return () => clearInterval(timer);
  }, [riskState?.riskScore]);

  useEffect(() => {
    if (!journeyActive || !currentLocation) return undefined;

    journeyStartRef.current = journeyStartRef.current ?? Date.now();
    lastJourneyRiskRef.current = lastJourneyRiskRef.current ?? riskState?.riskScore ?? 0;

    const monitor = async () => {
      const nextRisk = await calculateRoadRisk(currentLocation).catch(() => null);
      if (!nextRisk) return;

      if (lastJourneyRiskRef.current != null && nextRisk.riskScore >= lastJourneyRiskRef.current + 1.2) {
        setJourneyAlerts((current) => current + 1);
        Vibration?.vibrate?.(300);
        Alert.alert('Journey risk spike', 'Risk increased during your journey. Reduce speed and stay alert.');
      }

      if (nextRisk.riskLevel === 'HIGH' || nextRisk.riskLevel === 'DANGER') {
        setJourneyAlerts((current) => current + 1);
      }

      lastJourneyRiskRef.current = nextRisk.riskScore;
      setRiskState(nextRisk);
    };

    monitor();
    journeyTimerRef.current = setInterval(monitor, 30000);

    return () => {
      if (journeyTimerRef.current) clearInterval(journeyTimerRef.current);
    };
  }, [journeyActive, currentLocation]);

  const filteredPlaces = useMemo(() => {
    const activeCategory = mapFilterToCategory(selectedFilter);
    const source = activeCategory ? places.filter((item) => item.category === activeCategory) : places;

    return [...source].sort((a, b) => a.distanceKm - b.distanceKm);
  }, [places, selectedFilter]);

  const nearestSafeDestination = useMemo(() => selectNearestSafeDestination(filteredPlaces), [filteredPlaces]);

  const riskLevel = riskState?.riskLevel ?? 'LOW';
  const riskScore = riskState?.riskScore ?? 1;
  const riskColor = riskState ? interpolateRoadRiskColor(riskLevel) : '#10B981';
  const riskAlerts = riskState?.alerts ?? [];
  const riskFactors = riskState?.contributingFactors ?? [];
  const hotspotOverlays = getRiskOverlayHotspots();
  const activeLocation = currentLocation || sharedLocation || FALLBACK_LOCATION;
  const hospitalIntelligence = useMemo(
    () => buildHospitalIntelligence(activeLocation, latestTriageReport, bloodGroupFilter),
    [activeLocation, latestTriageReport, bloodGroupFilter]
  );
  const bestHospital = useMemo(
    () => selectBestHospital(activeLocation, latestTriageReport, bloodGroupFilter),
    [activeLocation, latestTriageReport, bloodGroupFilter]
  );
  const bloodMatchedHospitals = useMemo(
    () => getBloodMatchedHospitals(activeLocation, bloodGroupFilter, latestTriageReport),
    [activeLocation, bloodGroupFilter, latestTriageReport]
  );
  const hospitalLookup = useMemo(
    () => hospitalIntelligence.reduce((accumulator, hospital) => {
      accumulator[hospital.name] = hospital;
      return accumulator;
    }, {}),
    [hospitalIntelligence]
  );

  const safeRouteUrl = useMemo(() => {
    if (journeyDestination.trim()) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(journeyDestination.trim())}`;
    }
    if (!currentLocation || !nearestSafeDestination) return riskState?.safeRouteUrl ?? null;
    return buildSafeRouteUrl(currentLocation, { latitude: nearestSafeDestination.latitude, longitude: nearestSafeDestination.longitude });
  }, [currentLocation, journeyDestination, nearestSafeDestination, riskState]);

  const bestHospitalMapsUrl = useMemo(() => {
    if (!bestHospital) return null;
    return buildMapsDirectionsUrl(activeLocation, bestHospital);
  }, [activeLocation, bestHospital]);

  async function openSafeRoute() {
    if (!safeRouteUrl) {
      Alert.alert('Safe route unavailable', 'A nearest hospital route could not be generated yet.');
      return;
    }

    await Linking.openURL(safeRouteUrl);
  }

  async function routeToBestHospital() {
    if (!bestHospitalMapsUrl) {
      Alert.alert('Hospital route unavailable', 'A best-match hospital could not be selected yet.');
      return;
    }

    await Linking.openURL(bestHospitalMapsUrl);
  }

  async function handleCall(phoneNumber) {
    if (!phoneNumber) {
      Alert.alert('No phone number', 'Phone number is not available for this place.');
      return;
    }

    const dialUrl = `tel:${phoneNumber}`;
    const canCall = await Linking.canOpenURL(dialUrl);

    if (!canCall) {
      Alert.alert('Call unavailable', 'This device cannot place calls.');
      return;
    }

    await Linking.openURL(dialUrl);
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        {currentLocation ? (
          <View style={styles.mapStack}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
              showsUserLocation
              showsMyLocationButton>
              {filteredPlaces.map((place) => (
                <Marker
                  key={place.id}
                  coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                  title={place.name}
                  description={place.vicinity}
                  pinColor={place.markerColor}
                />
              ))}
            </MapView>

            <View pointerEvents="none" style={styles.riskOverlay}>
              <View style={[styles.riskBadge, { borderColor: riskColor, backgroundColor: `${riskColor}1A` }]}>
                <Text style={[styles.riskBadgeLabel, { color: riskColor }]}>Road Risk Predictor</Text>
                <Text style={styles.riskScoreText}>Score {riskScore.toFixed(1)} / 10</Text>
                <Text style={[styles.riskLevelText, { color: riskColor }]}>{riskLevel}</Text>
              </View>

              <View style={styles.arcGaugeTrack}>
                <View style={[styles.arcGaugeFill, { width: `${Math.max(12, Math.min(100, riskScore * 10))}%`, backgroundColor: riskColor }]} />
              </View>
            </View>

            <View pointerEvents="none" style={styles.heatmapOverlay}>
              {hotspotOverlays.map((feature, index) => {
                const position = projectHotspotToOverlay(currentLocation, feature);
                const dotSize = Math.max(14, Math.min(38, feature.properties.severity * 4));
                return (
                  <View
                    key={`${feature.properties.name}-${index}`}
                    style={[
                      styles.heatDot,
                      {
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                        left: `${position.left}%`,
                        top: `${position.top}%`,
                        opacity: 0.18 + feature.properties.severity * 0.06,
                        backgroundColor: feature.properties.severity >= 8 ? '#DC2626' : feature.properties.severity >= 7 ? '#F59E0B' : '#2563EB',
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.mapLoadingState}>
            <ActivityIndicator size="large" color="#E24B4A" />
            <Text style={styles.mapLoadingText}>Fetching current location...</Text>
          </View>
        )}
      </View>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={FILTER_OPTIONS}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => {
            const active = item === selectedFilter;
            return (
              <Pressable
                onPress={() => setSelectedFilter(item)}
                style={[styles.filterPill, active && styles.filterPillActive]}>
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{item}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {offlineMode ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>Offline mode — showing saved data</Text>
        </View>
      ) : null}

      {lastSyncedAt ? (
        <Text style={styles.syncTimestamp}>Last synced: {new Date(lastSyncedAt).toLocaleString()}</Text>
      ) : null}

      {fetchError ? <Text style={styles.errorText}>{fetchError}</Text> : null}

      {riskState ? (
        <View style={styles.riskDashboard}>
          <View style={styles.riskRow}>
            <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
            <Text style={styles.riskDashboardTitle}>Risk Dashboard</Text>
            <Text style={[styles.riskDashboardValue, { color: riskColor }]}>{riskLevel}</Text>
          </View>

          <Text style={styles.riskDashboardScore}>Current risk score: {displayRiskScore.toFixed(1)} / 10</Text>
          <Text style={styles.riskRateText}>This road has {riskState.accidentRateMultiplier?.toFixed(0) ?? '3'}x higher accident rate than city average</Text>

          <View style={styles.formulaCard}>
            <Text style={styles.formulaText}>Weather(0.3) + TimeOfDay(0.2) + RoadType(0.3) + History(0.2) = {riskScore.toFixed(1)}/10</Text>
            <View style={styles.formulaBarsRow}>
              {(riskState.factorBreakdown || []).map((factor) => (
                <View key={factor.label} style={styles.factorBarColumn}>
                  <Text style={styles.factorBarLabel}>{factor.label}</Text>
                  <View style={styles.factorBarTrack}>
                    <View
                      style={[
                        styles.factorBarFill,
                        { width: `${Math.min(100, Math.max(18, factor.contribution * 18))}%`, backgroundColor: riskColor },
                      ]}
                    />
                  </View>
                  <Text style={styles.factorBarValue}>{factor.contribution.toFixed(1)}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.factorRow}>
            {riskFactors.map((factor) => (
              <View key={factor.label} style={styles.factorChip}>
                <Text style={styles.factorChipText}>{factor.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.alertList}>
            {riskAlerts.map((alert) => (
              <Text key={alert} style={styles.riskAlertText}>• {alert}</Text>
            ))}
            {nearestSafeDestination ? (
              <Text style={styles.riskAlertText}>
                • Medical facility {Math.max(1, Math.round(nearestSafeDestination.distanceKm * 1000))}m left — note for emergencies
              </Text>
            ) : null}
          </View>

          <Pressable style={[styles.safeRouteButton, { borderColor: riskColor }]} onPress={openSafeRoute}>
            <Text style={styles.safeRouteButtonText}>Open safest route in Google Maps</Text>
          </Pressable>

          <View style={styles.journeyCard}>
            <Text style={styles.journeyTitle}>Journey Safety Monitor</Text>
            <TextInput
              value={journeyDestination}
              onChangeText={setJourneyDestination}
              placeholder="Enter destination (e.g. Lucknow Airport)"
              placeholderTextColor="#94A3B8"
              style={styles.journeyInput}
            />
            <View style={styles.journeyActionsRow}>
              <Pressable
                style={[styles.journeyButton, journeyActive && styles.journeyButtonActive]}
                onPress={() =>
                  setJourneyActive((current) => {
                    const nextValue = !current;
                    if (current) {
                      const startedAt = journeyStartRef.current || Date.now();
                      setJourneySummary({
                        minutes: Math.max(1, Math.round((Date.now() - startedAt) / 60000)),
                        alerts: journeyAlerts,
                        safe: journeyAlerts === 0,
                      });
                      journeyStartRef.current = null;
                      lastJourneyRiskRef.current = null;
                    } else {
                      setJourneySummary(null);
                      setJourneyAlerts(0);
                      journeyStartRef.current = Date.now();
                    }
                    return nextValue;
                  })
                }
              >
                <Text style={styles.journeyButtonText}>{journeyActive ? 'Stop Monitor' : 'Start Monitor'}</Text>
              </Pressable>
              <Text style={styles.journeyHint}>{journeyActive ? 'Monitoring every 30 seconds' : 'Monitor risk every 30 seconds during journey'}</Text>
            </View>
            {journeySummary ? (
              <Text style={styles.journeySummary}>{`${journeySummary.minutes} min journey, ${journeySummary.alerts} risk alerts, you are ${journeySummary.safe ? 'safe' : 'safer now'}`}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.hospitalIntelCard}>
        <View style={styles.cardTopRow}>
          <Text style={styles.hospitalIntelTitle}>Hospital Intelligence</Text>
          <View style={styles.bestHospitalPill}>
            <Text style={styles.bestHospitalPillText}>SMART NEARBY</Text>
          </View>
        </View>

        <Text style={styles.hospitalIntelSubtitle}>Ranked for {latestTriageReport?.emergencyType ?? 'your current emergency'} in Lucknow.</Text>

        <View style={styles.bloodRow}>
          <Text style={styles.bloodLabel}>Blood group</Text>
          <TextInput
            value={bloodGroupFilter}
            onChangeText={setBloodGroupFilter}
            style={styles.bloodInput}
            placeholder="B+"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {bestHospital ? (
          <View style={styles.bestHospitalCard}>
            <Text style={styles.bestHospitalTag}>BEST FOR YOUR EMERGENCY</Text>
            <Text style={styles.bestHospitalName}>{bestHospital.name}</Text>
            <Text style={styles.bestHospitalLine}>ER wait: {bestHospital.waitTime} min</Text>
            <Text style={styles.bestHospitalLine}>Trauma center: Level {bestHospital.traumaLevel}</Text>
            <Text style={styles.bestHospitalLine}>ICU: {bestHospital.icu ? 'Yes' : 'No'}</Text>
            <Text style={styles.bestHospitalLine}>Blood bank: {bestHospital.bloodBank ? 'Yes' : 'No'}</Text>
            <Text style={styles.bestHospitalLine}>Distance: {bestHospital.distanceKm.toFixed(2)} km</Text>
            <Text style={styles.bestHospitalLine}>Ambulance ETA: {bestHospital.ambulanceEta} min</Text>
            <Pressable style={styles.routeBestButton} onPress={routeToBestHospital}>
              <Text style={styles.routeBestButtonText}>Route to Best Hospital</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.bloodResultTitle}>Hospitals with matching blood</Text>
        {bloodMatchedHospitals.slice(0, 3).map((hospital) => (
          <View key={hospital.id} style={styles.bloodResultCard}>
            <Text style={styles.bloodResultName}>{hospital.name}</Text>
            <Text style={styles.bloodResultLine}>{hospital.vicinity}</Text>
            <Text style={styles.bloodResultLine}>Blood: {bloodGroupFilter} available</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={styles.skeletonList}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={filteredPlaces}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={[styles.categoryBadge, { backgroundColor: item.markerColor }]}>
                  <Text style={styles.categoryBadgeText}>{item.category}</Text>
                </View>
              </View>

              <Text style={styles.cardSubText}>{item.vicinity}</Text>
              <Text style={styles.cardSubText}>Distance: {item.distanceKm.toFixed(2)} km</Text>
              <Text style={styles.cardSubText}>{formatOpenStatus(item.openNow)}</Text>

              {item.category === 'Hospital' && hospitalLookup[item.name] ? (
                <View style={styles.hospitalDetailBlock}>
                  <Text style={styles.hospitalDetailLine}>ER wait: {hospitalLookup[item.name].waitTime} min</Text>
                  <Text style={styles.hospitalDetailLine}>Trauma level: Level {hospitalLookup[item.name].traumaLevel}</Text>
                  <Text style={styles.hospitalDetailLine}>ICU: {hospitalLookup[item.name].icu ? 'Yes' : 'No'} · Blood bank: {hospitalLookup[item.name].bloodBank ? 'Yes' : 'No'}</Text>
                  <Text style={styles.hospitalDetailLine}>Ambulance ETA: {hospitalLookup[item.name].ambulanceEta} min</Text>
                  <Text style={styles.hospitalDetailTag}>{hospitalLookup[item.name].bestForLabel || 'Nearby hospital'}</Text>
                </View>
              ) : null}

              <Pressable style={styles.callButton} onPress={() => handleCall(item.phoneNumber)}>
                <Text style={styles.callButtonText}>
                  {item.phoneNumber ? `Call ${item.phoneNumber}` : 'Phone unavailable'}
                </Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No nearby places found for the selected filter.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mapWrap: {
    height: '42%',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#E2E8F0',
  },
  map: {
    flex: 1,
  },
  mapStack: {
    flex: 1,
  },
  riskOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    gap: 8,
  },
  heatmapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heatDot: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  riskBadge: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  riskBadgeLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  riskScoreText: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  riskLevelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  arcGaugeTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.3)',
    overflow: 'hidden',
  },
  arcGaugeFill: {
    height: '100%',
    borderRadius: 999,
  },
  riskDashboard: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riskDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  riskDashboardTitle: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  riskDashboardValue: {
    fontWeight: '900',
    fontSize: 14,
  },
  riskDashboardScore: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '900',
  },
  riskRateText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  formulaCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  formulaText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  formulaBarsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  factorBarColumn: {
    width: '48%',
    gap: 4,
  },
  factorBarLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  factorBarTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  factorBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  factorBarValue: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
  },
  factorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  factorChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  factorChipText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  alertList: {
    gap: 4,
  },
  riskAlertText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  safeRouteButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  safeRouteButtonText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
  },
  journeyCard: {
    borderRadius: 12,
    backgroundColor: '#0F172A',
    padding: 12,
    gap: 10,
  },
  journeyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  journeyInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  journeyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  journeyButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E24B4A',
  },
  journeyButtonActive: {
    backgroundColor: '#2563EB',
  },
  journeyButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  journeyHint: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 12,
  },
  journeySummary: {
    color: '#A7F3D0',
    fontWeight: '700',
  },
  hospitalIntelCard: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: '#08111F',
    borderWidth: 1,
    borderColor: '#1D4ED8',
    padding: 14,
    gap: 10,
  },
  hospitalIntelTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  hospitalIntelSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
  },
  bestHospitalPill: {
    borderRadius: 999,
    backgroundColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bestHospitalPillText: {
    color: '#064E3B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  bloodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bloodLabel: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '800',
  },
  bloodInput: {
    flex: 1,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
  },
  bestHospitalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    gap: 5,
    borderWidth: 1,
    borderColor: '#1E3A8A',
  },
  bestHospitalTag: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  bestHospitalName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  bestHospitalLine: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  routeBestButton: {
    marginTop: 6,
    backgroundColor: '#E24B4A',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  routeBestButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  bloodResultTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  bloodResultCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
  bloodResultName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  bloodResultLine: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  mapLoadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  mapLoadingText: {
    color: '#475569',
    fontSize: 14,
  },
  filterRow: {
    paddingTop: 10,
  },
  offlineBanner: {
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  offlineBannerText: {
    color: '#92400E',
    fontWeight: '700',
    fontSize: 13,
  },
  syncTimestamp: {
    color: '#475569',
    fontSize: 12,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 12,
    gap: 8,
    paddingBottom: 10,
  },
  filterPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  filterPillActive: {
    backgroundColor: '#E24B4A',
    borderColor: '#E24B4A',
  },
  filterLabel: {
    color: '#334155',
    fontWeight: '600',
  },
  filterLabelActive: {
    color: '#FFFFFF',
  },
  skeletonList: {
    paddingHorizontal: 14,
    paddingBottom: 20,
    gap: 10,
  },
  skeletonCard: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 5,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardSubText: {
    color: '#334155',
    fontSize: 13,
  },
  hospitalDetailBlock: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    padding: 10,
    gap: 3,
  },
  hospitalDetailLine: {
    color: '#1E3A8A',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  hospitalDetailTag: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  callButton: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  callButtonText: {
    color: '#1E3A8A',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#64748B',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
});
