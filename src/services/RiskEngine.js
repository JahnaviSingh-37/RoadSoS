import { ROAD_RISK_HOTSPOTS } from '@/data/roadRiskHotspots';

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

function weatherCodeSummary(code) {
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
    return { wetRoad: true, poorVisibility: false, label: 'rain' };
  }
  if ([45, 48].includes(code)) {
    return { wetRoad: false, poorVisibility: true, label: 'fog' };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { wetRoad: true, poorVisibility: true, label: 'snow' };
  }
  if ([95, 96, 99].includes(code)) {
    return { wetRoad: true, poorVisibility: true, label: 'thunderstorm' };
  }
  return { wetRoad: false, poorVisibility: false, label: 'clear' };
}

function trafficHourFactor(date) {
  const hour = date.getHours();
  const weekday = date.getDay() >= 1 && date.getDay() <= 5;
  const rushHour = (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20);
  return weekday && rushHour ? 1 : hour >= 22 || hour <= 5 ? 0.2 : 0.5;
}

function nearestHotspot(location) {
  let nearest = null;

  for (const feature of ROAD_RISK_HOTSPOTS.features) {
    const [longitude, latitude] = feature.geometry.coordinates;
    const distanceKm = haversineDistanceKm(location, { latitude, longitude });
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = {
        ...feature,
        latitude,
        longitude,
        distanceKm,
      };
    }
  }

  return nearest;
}

function riskLevelFromScore(score) {
  if (score >= 8.5) return 'DANGER';
  if (score >= 6.5) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  return 'LOW';
}

function riskColor(level) {
  switch (level) {
    case 'DANGER': return '#DC2626';
    case 'HIGH': return '#F97316';
    case 'MEDIUM': return '#F59E0B';
    default: return '#10B981';
  }
}

function riskContributionLabel(label, score) {
  return { label, score };
}

async function fetchOpenMeteoWeather(location) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('current', 'temperature_2m,precipitation,weather_code,visibility,wind_speed_10m,is_day');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Weather request failed with ${response.status}`);
  }

  const payload = await response.json();
  return payload.current ?? null;
}

export async function calculateRoadRisk(location, now = new Date()) {
  const weather = await fetchOpenMeteoWeather(location).catch(() => null);
  const hotspot = nearestHotspot(location);
  const weatherSummary = weatherCodeSummary(weather?.weather_code ?? 0);
  const trafficFactor = trafficHourFactor(now);

  const wetRoadScore = weatherSummary.wetRoad ? 2.2 : (weather?.precipitation ?? 0) > 0 ? 1.8 : 0;
  const visibilityScore = weatherSummary.poorVisibility || (weather?.visibility ?? 20000) < 5000 ? 2.4 : (weather?.visibility ?? 20000) < 10000 ? 1.1 : 0;
  const trafficScore = trafficFactor >= 1 ? 2.0 : trafficFactor >= 0.5 ? 0.9 : 0.3;
  const hotspotScore = hotspot && hotspot.distanceKm <= 5 ? Math.max(0.5, 3 - hotspot.distanceKm * 0.4) : hotspot && hotspot.distanceKm <= 12 ? 0.9 : 0.2;

  const rawScore = wetRoadScore + visibilityScore + trafficScore + hotspotScore;
  const riskScore = Math.max(1, Math.min(10, Number(rawScore.toFixed(1))));
  const riskLevel = riskLevelFromScore(riskScore);
  const color = riskColor(riskLevel);

  const factorBreakdown = [
    {
      label: 'Weather',
      weight: 0.3,
      contribution: Number(Math.min(10, (wetRoadScore + visibilityScore) * 1.2).toFixed(1)),
    },
    {
      label: 'Time of Day',
      weight: 0.2,
      contribution: Number((trafficScore * 3).toFixed(1)),
    },
    {
      label: 'Road Type',
      weight: 0.3,
      contribution: Number((hotspotScore * 3.2).toFixed(1)),
    },
    {
      label: 'History',
      weight: 0.2,
      contribution: Number((hotspot && hotspot.distanceKm <= 12 ? Math.min(3, 3 - hotspot.distanceKm * 0.2) : 0.4).toFixed(1)),
    },
  ];

  const contributingFactors = [
    weatherSummary.wetRoad || (weather?.precipitation ?? 0) > 0 ? riskContributionLabel('wet road', 1) : null,
    weatherSummary.poorVisibility || (weather?.visibility ?? 20000) < 10000 ? riskContributionLabel('poor visibility', 1) : null,
    trafficFactor >= 1 ? riskContributionLabel('high traffic hour', 1) : null,
    hotspot && hotspot.distanceKm <= 12 ? riskContributionLabel('accident-prone zone', 1) : null,
  ].filter(Boolean);

  const alerts = [];
  if (hotspot && hotspot.distanceKm <= 2.5) {
    alerts.push(`High accident zone ahead in ${Math.max(1, Math.round(hotspot.distanceKm * 10) / 10)} km`);
  }
  if (weatherSummary.poorVisibility || (weather?.visibility ?? 20000) < 6000) {
    alerts.push('Fog warning — reduce speed');
  }

  return {
    riskScore,
    riskLevel,
    color,
    factorBreakdown,
    accidentRateMultiplier: hotspot && hotspot.distanceKm <= 12 ? 3 : 1.4,
    contributingFactors,
    alerts,
    weather,
    weatherLabel: weatherSummary.label,
    hotspot,
    shouldHeadsUp: riskLevel === 'HIGH' || riskLevel === 'DANGER',
    safeRouteUrl: buildSafeRouteUrl(location, null),
  };
}

export function buildSafeRouteUrl(origin, destination) {
  if (!origin || !destination) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
}

export function selectNearestSafeDestination(places) {
  const hospitals = (places ?? []).filter((item) => item.category === 'Hospital');
  if (!hospitals.length) return null;
  return hospitals.reduce((closest, item) => (item.distanceKm < closest.distanceKm ? item : closest), hospitals[0]);
}

export function getRiskLevelLabel(score) {
  return riskLevelFromScore(score);
}

export function getRiskLevelColor(level) {
  return riskColor(level);
}

export function getRiskOverlayHotspots() {
  return ROAD_RISK_HOTSPOTS.features;
}
