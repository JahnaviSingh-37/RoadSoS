const MOCK_SERVICE_SEEDS = [
  {
    category: 'Hospital',
    markerColor: '#E24B4A',
    name: 'King George’s Medical University',
    vicinity: 'Shah Mina Rd, Chowk, Lucknow',
    phoneNumber: '+91 522 225 7540',
    latitude: 26.8714,
    longitude: 80.9345,
  },
  {
    category: 'Hospital',
    markerColor: '#E24B4A',
    name: 'Apollo Medics Super Speciality Hospital',
    vicinity: 'Kanpur Road, Lucknow',
    phoneNumber: '+91 522 666 2000',
    latitude: 26.7803,
    longitude: 80.9094,
  },
  {
    category: 'Police',
    markerColor: '#2563EB',
    name: 'Hazratganj Police Station',
    vicinity: 'Hazratganj, Lucknow',
    phoneNumber: '112',
    latitude: 26.8504,
    longitude: 80.9462,
  },
  {
    category: 'Police',
    markerColor: '#2563EB',
    name: 'Gomti Nagar Police Station',
    vicinity: 'Vibhuti Khand, Lucknow',
    phoneNumber: '112',
    latitude: 26.8667,
    longitude: 81.0000,
  },
  {
    category: 'Fire',
    markerColor: '#F59E0B',
    name: 'Lucknow Fire Station',
    vicinity: 'Aminabad, Lucknow',
    phoneNumber: '101',
    latitude: 26.8550,
    longitude: 80.9264,
  },
  {
    category: 'Fire',
    markerColor: '#F59E0B',
    name: 'Aliganj Fire Station',
    vicinity: 'Aliganj, Lucknow',
    phoneNumber: '101',
    latitude: 26.8833,
    longitude: 80.9510,
  },
];

export function generateMockNearbyServices(currentLocation) {
  return MOCK_SERVICE_SEEDS.map((service, index) => ({
    id: `mock-${service.category}-${index}`,
    category: service.category,
    markerColor: service.markerColor,
    name: service.name,
    distanceKm: currentLocation
      ? Math.max(0.3, Math.round(((service.latitude - currentLocation.latitude) ** 2 + (service.longitude - currentLocation.longitude) ** 2) * 2800) / 10)
      : Number((0.6 + index * 0.4).toFixed(1)),
    latitude: service.latitude,
    longitude: service.longitude,
    openNow: true,
    phoneNumber: service.phoneNumber,
    vicinity: service.vicinity,
  }));
}
