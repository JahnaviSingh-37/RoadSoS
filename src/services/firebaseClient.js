const mockSosStore = {};

export function saveSOSLocation(sessionId, coords) {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  mockSosStore[sessionId] = {
    sessionId,
    ...(mockSosStore[sessionId] ?? {}),
    latest: {
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      accuracy: coords?.accuracy ?? null,
      address: coords?.address ?? null,
      countryCode: coords?.countryCode ?? null,
      timestamp: Date.now(),
    },
  };

  return mockSosStore[sessionId].latest;
}

export function getSOSLocation(sessionId) {
  return mockSosStore[sessionId]?.latest ?? null;
}

export function generateSessionId() {
  return Math.random().toString(36).slice(2, 10);
}

export function generateTrackingLink(sessionId) {
  return `https://roadsos.mock/track/${sessionId}`;
}

export const mockFirebaseStore = mockSosStore;
