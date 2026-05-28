import {
    generateSessionId,
    generateTrackingLink,
    saveSOSLocation,
} from '@/services/firebaseClient';

const TRACKING_INTERVAL_MS = 5000;
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;

const activeSessions = new Map();
const sessionMetadata = new Map();

function normalizeSnapshot(snapshot) {
  return {
    latitude: snapshot?.latitude ?? null,
    longitude: snapshot?.longitude ?? null,
    accuracy: snapshot?.accuracy ?? null,
    address: snapshot?.address ?? null,
    countryCode: snapshot?.countryCode ?? null,
  };
}

function clearSessionTimers(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return;
  }

  clearInterval(session.intervalId);
  clearTimeout(session.expiryTimeoutId);
  activeSessions.delete(sessionId);
}

export async function expireSosSession(sessionId) {
  clearSessionTimers(sessionId);

  const existing = sessionMetadata.get(sessionId) ?? {};
  sessionMetadata.set(sessionId, {
    ...existing,
    status: 'expired',
    expiredAt: Date.now(),
  });
}

export async function stopSosSession(sessionId, reason = 'stopped') {
  clearSessionTimers(sessionId);

  const existing = sessionMetadata.get(sessionId) ?? {};
  sessionMetadata.set(sessionId, {
    ...existing,
    status: reason,
    stoppedAt: Date.now(),
  });
}

export async function startSosTrackingSession({ getSnapshot }) {
  const sessionId = generateSessionId();
  const createdAt = Date.now();
  const expiresAt = createdAt + SESSION_DURATION_MS;
  const trackingLink = generateTrackingLink(sessionId);

  const firstSnapshot = normalizeSnapshot(await getSnapshot());

  saveSOSLocation(sessionId, firstSnapshot);
  sessionMetadata.set(sessionId, {
    sessionId,
    status: 'active',
    createdAt,
    expiresAt,
    trackingLink,
    lastUpdatedAt: createdAt,
  });

  const pushUpdate = async () => {
    const now = Date.now();
    if (now >= expiresAt) {
      await expireSosSession(sessionId);
      return;
    }

    const snapshot = normalizeSnapshot(await getSnapshot());
    saveSOSLocation(sessionId, snapshot);
    const existing = sessionMetadata.get(sessionId) ?? {};
    sessionMetadata.set(sessionId, {
      ...existing,
      lastUpdatedAt: now,
    });
  };

  const intervalId = setInterval(() => {
    void pushUpdate();
  }, TRACKING_INTERVAL_MS);

  const expiryTimeoutId = setTimeout(() => {
    void expireSosSession(sessionId);
  }, SESSION_DURATION_MS);

  activeSessions.set(sessionId, { intervalId, expiryTimeoutId });

  return { sessionId, trackingLink, expiresAt };
}
