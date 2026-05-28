const MOCK_HOSPITALS = [
  {
    id: 'kgmu',
    name: 'King George\'s Medical University',
    vicinity: 'Shah Mina Rd, Chowk, Lucknow',
    latitude: 26.8714,
    longitude: 80.9345,
    traumaLevel: 1,
    icu: true,
    bloodBank: true,
    bloodTypes: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
  },
  {
    id: 'apollo',
    name: 'Apollo Medics Super Speciality Hospital',
    vicinity: 'Kanpur Road, Lucknow',
    latitude: 26.7803,
    longitude: 80.9094,
    traumaLevel: 2,
    icu: true,
    bloodBank: true,
    bloodTypes: ['A+', 'B+', 'AB+', 'O+'],
  },
  {
    id: 'hajaratganj-care',
    name: 'Hazaratganj Trauma Care Centre',
    vicinity: 'Hazratganj, Lucknow',
    latitude: 26.8495,
    longitude: 80.9461,
    traumaLevel: 2,
    icu: true,
    bloodBank: false,
    bloodTypes: [],
  },
  {
    id: 'gomti-hospital',
    name: 'Gomti Nagar Critical Care Hospital',
    vicinity: 'Vibhuti Khand, Lucknow',
    latitude: 26.8667,
    longitude: 81.0,
    traumaLevel: 3,
    icu: true,
    bloodBank: true,
    bloodTypes: ['B+', 'AB+', 'O+'],
  },
  {
    id: 'charbagh-emergency',
    name: 'Charbagh Emergency Hospital',
    vicinity: 'Charbagh, Lucknow',
    latitude: 26.8396,
    longitude: 80.9243,
    traumaLevel: 2,
    icu: false,
    bloodBank: true,
    bloodTypes: ['A+', 'B+', 'O+'],
  },
  {
    id: 'aliganj-speciality',
    name: 'Aliganj Speciality Hospital',
    vicinity: 'Aliganj, Lucknow',
    latitude: 26.8833,
    longitude: 80.951,
    traumaLevel: 3,
    icu: true,
    bloodBank: true,
    bloodTypes: ['A+', 'B+', 'AB+', 'O+', 'O-'],
  },
];

function haversineDistanceKm(a, b) {
  const earthRadiusKm = 6371;
  const latDelta = ((b.latitude - a.latitude) * Math.PI) / 180;
  const lonDelta = ((b.longitude - a.longitude) * Math.PI) / 180;
  const startLat = (a.latitude * Math.PI) / 180;
  const endLat = (b.latitude * Math.PI) / 180;
  const h = Math.sin(latDelta / 2) ** 2 + Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function seededNumber(seed, min, max) {
  const value = Math.abs(Math.sin(seed) * 10000) % 1;
  return min + value * (max - min);
}

function traumaScore(traumaLevel) {
  return traumaLevel === 1 ? 0.5 : traumaLevel === 2 ? 1.5 : 2.5;
}

function ambulanceEtaMinutes(distanceKm) {
  const carMinutes = Math.max(3, distanceKm * 3.2);
  return Math.max(4, Math.round(carMinutes * 1.5));
}

export function buildHospitalIntelligence(location, triage = {}, bloodGroup = 'B+') {
  if (!location) return [];

  // Ensure triage is an object, not null or undefined
  const safeTriage = triage || {};

  return MOCK_HOSPITALS.map((hospital) => {
    const distanceKm = haversineDistanceKm(location, hospital);
    const waitTime = Math.round(seededNumber(distanceKm + hospital.traumaLevel, 5, 45));
    const ambulanceEta = ambulanceEtaMinutes(distanceKm);
    const score = Number((distanceKm * 0.4 + waitTime * 0.3 + traumaScore(hospital.traumaLevel) * 0.3).toFixed(2));
    const supportsBlood = hospital.bloodTypes.includes(bloodGroup);
    const triageType = safeTriage.emergencyType || safeTriage.severityLabel || 'medical';
    const matchWeight = triageType === 'accident' ? hospital.traumaLevel <= 2 : triageType === 'fire' ? hospital.name.includes('Emergency') : true;

    return {
      ...hospital,
      distanceKm,
      waitTime,
      ambulanceEta,
      score,
      hasMatchingBlood: supportsBlood,
      bestForEmergency: matchWeight,
      bestForLabel: matchWeight ? `Best for ${triageType}` : null,
      medicalScore: score,
    };
  }).sort((a, b) => a.score - b.score);
}

export function selectBestHospital(location, triage = {}, bloodGroup = 'B+') {
  const hospitals = buildHospitalIntelligence(location, triage, bloodGroup);
  return hospitals[0] ?? null;
}

export function buildMapsDirectionsUrl(origin, destination) {
  if (!origin || !destination) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
}

export function formatHospitalEmergencyTag(hospital, triage = {}) {
  if (!hospital) return '';
  if (hospital.bestForEmergency) {
    return `BEST FOR YOUR ${String(triage.emergencyType || 'EMERGENCY').toUpperCase()}`;
  }
  return hospital.traumaLevel === 1 ? 'LEVEL 1 TRAUMA' : hospital.icu ? 'ICU READY' : 'BLOOD BANK AVAILABLE';
}

export function getBloodMatchedHospitals(location, bloodGroup, triage = {}) {
  return buildHospitalIntelligence(location, triage, bloodGroup).filter((hospital) => hospital.hasMatchingBlood);
}

export const MOCK_LUCKNOW_HOSPITALS = MOCK_HOSPITALS;
