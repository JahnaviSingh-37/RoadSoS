const FIXED_COORDS = {
  latitude: 26.8467,
  longitude: 80.9462,
  accuracy: 20,
  altitude: null,
  heading: null,
  speed: null,
};

export const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
};

export async function requestForegroundPermissionsAsync() {
  return { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };
}

export async function requestBackgroundPermissionsAsync() {
  return { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };
}

export async function getCurrentPositionAsync() {
  return {
    coords: { ...FIXED_COORDS },
    timestamp: Date.now(),
  };
}

export async function watchPositionAsync(_options, callback) {
  callback?.({ coords: { ...FIXED_COORDS }, timestamp: Date.now() });
  return { remove: () => {} };
}

export async function reverseGeocodeAsync() {
  return [
    {
      name: 'Hazratganj',
      street: 'Mahatma Gandhi Marg',
      city: 'Lucknow',
      region: 'Uttar Pradesh',
      country: 'India',
      postalCode: '226001',
      isoCountryCode: 'IN',
    },
  ];
}
