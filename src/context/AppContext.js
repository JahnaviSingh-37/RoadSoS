import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEYS = {
  profile: 'roadsos_profile',
  contacts: 'roadsos_contacts',
  autoShareMedicalId: 'roadsos_auto_share_medical_id',
  voiceSosEnabled: 'roadsos_voice_sos_enabled',
  incidentHistory: 'roadsos_incident_history',
  latestTriage: 'roadsos_latest_triage',
  currentLocation: 'roadsos_current_location',
  activeIncident: 'roadsos_active_incident',
  latestIncidentReport: 'roadsos_latest_incident_report',
  demoModeEnabled: 'demo_mode_enabled',
};

export const DEFAULT_PROFILE = {
  name: 'Aarav Verma',
  bloodGroup: 'B+',
  conditions: 'Asthma, allergy to penicillin',
  address: 'Indira Nagar, Lucknow',
};

export const DEFAULT_CONTACTS = [
  { name: 'Priya Verma', relation: 'Spouse', phone: '+91 98765 43210' },
  { name: 'Rohan Verma', relation: 'Brother', phone: '+91 98111 22334' },
  { name: 'Dr. Meera Singh', relation: 'Family Doctor', phone: '+91 90000 11223' },
];

export const DEFAULT_LOCATION = {
  latitude: 26.8467,
  longitude: 80.9462,
  address: 'Indira Nagar, Lucknow',
  label: 'Lucknow, India',
};

const DEFAULT_PREFERENCES = {
  autoShareMedicalId: true,
  voiceSosEnabled: false,
  demoModeEnabled: false,
};

const INITIAL_INCIDENT_HISTORY = [];

const AppContext = createContext(null);

function safeParse(jsonValue, fallbackValue) {
  if (!jsonValue) return fallbackValue;
  try {
    return JSON.parse(jsonValue);
  } catch {
    return fallbackValue;
  }
}

function normalizeLocation(location) {
  if (!location || typeof location !== 'object') {
    return DEFAULT_LOCATION;
  }

  return {
    latitude: Number(location.latitude ?? DEFAULT_LOCATION.latitude),
    longitude: Number(location.longitude ?? DEFAULT_LOCATION.longitude),
    address: location.address ?? DEFAULT_LOCATION.address,
    label: location.label ?? DEFAULT_LOCATION.label,
  };
}

function buildSessionId() {
  return `SOS-${Date.now().toString(36).toUpperCase()}`;
}

function buildBroadcastMessage({ profile, location, triage, contacts, sessionId, timestamp }) {
  const contact = contacts?.[0] ?? { name: 'Emergency contact', phone: 'n/a' };
  const incidentLabel = triage?.emergencyType ?? triage?.severityLabel ?? 'medical';
  const locationLabel = location?.address ?? 'Location unavailable';
  const coordinates = location && location.latitude && location.longitude ? `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}` : 'n/a';
  const triageLabel = triage?.recommendedAction ?? triage?.signalSummary ?? 'Emergency response required';

  return [
    '🚨 EMERGENCY ALERT',
    `Person: ${profile?.name ?? 'Unknown'}`,
    `Blood: ${profile?.bloodGroup ?? 'n/a'}`,
    `Location: ${locationLabel}`,
    `Coordinates: ${coordinates}`,
    `Incident: ${incidentLabel}`,
    `Time: ${new Date(timestamp ?? Date.now()).toLocaleString()}`,
    `Track live: roadsos.app/track/${sessionId ?? 'live'}`,
    `Medical conditions: ${profile?.conditions ?? 'None'}`,
    `Emergency contact: ${contact.name} ${contact.phone}`,
    `Triage summary: ${triageLabel}`,
  ].join('\n');
}

function buildIncidentReport({ activeIncident, profile, location, triage, contacts, resolution }) {
  const durationMs = Math.max(0, Date.now() - (activeIncident?.startedAt ?? Date.now()));
  const durationSeconds = Math.floor(durationMs / 1000);
  const minutes = String(Math.floor(durationSeconds / 60)).padStart(2, '0');
  const seconds = String(durationSeconds % 60).padStart(2, '0');
  const hours = String(Math.floor(durationSeconds / 3600)).padStart(2, '0');
  const reportId = `INC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

  return {
    reportId,
    sessionId: activeIncident?.sessionId ?? buildSessionId(),
    dateTime: new Date(activeIncident?.startedAt ?? Date.now()).toLocaleString(),
    duration: `${hours}:${minutes}:${seconds}`,
    trigger: activeIncident?.trigger ?? 'Emergency trigger',
    severity: triage?.severityLabel ?? 'CRITICAL',
    aiConfidence: `${Math.round(triage?.confidenceScore ?? 89)}%`,
    locationName: location?.address ?? profile?.address ?? 'Lucknow, India',
    coordinates: location ? `${location.latitude.toFixed(4)}°N, ${location.longitude.toFixed(4)}°E` : 'n/a',
    ambulanceCalled: resolution?.ambulanceCalled ?? '108',
    responseTime: resolution?.responseTime ?? triage?.estimatedResponseTime ?? '7 min',
    hospital: resolution?.hospital ?? triage?.bestHospital?.name ?? 'KGMU Lucknow',
    witnessesAlerted: resolution?.witnessesAlerted ?? 4,
    firstAidSteps: resolution?.firstAidSteps ?? triage?.firstAidSteps ?? [],
    summary: resolution?.summary ?? triage?.recommendedAction ?? 'Emergency handled',
    contact: contacts?.[0] ?? null,
    createdAt: Date.now(),
    resolvedAt: Date.now(),
    medicalId: {
      name: profile?.name ?? 'Unknown',
      bloodGroup: profile?.bloodGroup ?? 'n/a',
      conditions: profile?.conditions ?? 'None',
      address: profile?.address ?? 'Lucknow, India',
      location,
    },
    triage,
  };
}

export function AppProvider({ children }) {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [contacts, setContacts] = useState(DEFAULT_CONTACTS);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [currentLocation, setCurrentLocation] = useState(DEFAULT_LOCATION);
  const [latestTriageReport, setLatestTriageReport] = useState(null);
  const [activeIncident, setActiveIncident] = useState(null);
  const [latestIncidentReport, setLatestIncidentReport] = useState(null);
  const [incidentHistory, setIncidentHistory] = useState(INITIAL_INCIDENT_HISTORY);
  const [latestBroadcastMessage, setLatestBroadcastMessage] = useState('');
  const [demoFlowStep, setDemoFlowStep] = useState('idle');

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [savedProfile, savedContacts, savedAutoShare, savedVoice, savedDemoMode, savedLocation, savedTriage, savedActiveIncident, savedHistory, savedLatestReport] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.profile),
        AsyncStorage.getItem(STORAGE_KEYS.contacts),
        AsyncStorage.getItem(STORAGE_KEYS.autoShareMedicalId),
        AsyncStorage.getItem(STORAGE_KEYS.voiceSosEnabled),
        AsyncStorage.getItem(STORAGE_KEYS.demoModeEnabled),
        AsyncStorage.getItem(STORAGE_KEYS.currentLocation),
        AsyncStorage.getItem(STORAGE_KEYS.latestTriage),
        AsyncStorage.getItem(STORAGE_KEYS.activeIncident),
        AsyncStorage.getItem(STORAGE_KEYS.incidentHistory),
        AsyncStorage.getItem(STORAGE_KEYS.latestIncidentReport),
      ]);

      if (!mounted) return;

      if (savedProfile) setProfile(safeParse(savedProfile, DEFAULT_PROFILE));
      if (savedContacts) setContacts(safeParse(savedContacts, DEFAULT_CONTACTS));

      const nextPreferences = { ...DEFAULT_PREFERENCES };
      if (savedAutoShare != null) nextPreferences.autoShareMedicalId = savedAutoShare === 'true';
      if (savedVoice != null) nextPreferences.voiceSosEnabled = savedVoice === 'true';
      if (savedDemoMode != null) nextPreferences.demoModeEnabled = savedDemoMode === 'true';
      setPreferences(nextPreferences);

      if (savedLocation) setCurrentLocation(normalizeLocation(safeParse(savedLocation, DEFAULT_LOCATION)));
      if (savedTriage) setLatestTriageReport(safeParse(savedTriage, null));
      if (savedActiveIncident) setActiveIncident(safeParse(savedActiveIncident, null));
      if (savedHistory) setIncidentHistory(safeParse(savedHistory, INITIAL_INCIDENT_HISTORY));
      if (savedLatestReport) setLatestIncidentReport(safeParse(savedLatestReport, null));

      setHydrated(true);
    })().catch(() => {
      if (mounted) {
        setHydrated(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile)).catch(() => null);
  }, [hydrated, profile]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.contacts, JSON.stringify(contacts)).catch(() => null);
  }, [hydrated, contacts]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.autoShareMedicalId, String(preferences.autoShareMedicalId)).catch(() => null);
    AsyncStorage.setItem(STORAGE_KEYS.voiceSosEnabled, String(preferences.voiceSosEnabled)).catch(() => null);
    AsyncStorage.setItem(STORAGE_KEYS.demoModeEnabled, String(preferences.demoModeEnabled)).catch(() => null);
  }, [hydrated, preferences]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.currentLocation, JSON.stringify(currentLocation)).catch(() => null);
  }, [hydrated, currentLocation]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.latestTriage, JSON.stringify(latestTriageReport)).catch(() => null);
  }, [hydrated, latestTriageReport]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.activeIncident, JSON.stringify(activeIncident)).catch(() => null);
  }, [hydrated, activeIncident]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.incidentHistory, JSON.stringify(incidentHistory)).catch(() => null);
  }, [hydrated, incidentHistory]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.latestIncidentReport, JSON.stringify(latestIncidentReport)).catch(() => null);
  }, [hydrated, latestIncidentReport]);

  const contextValue = useMemo(() => {
    function setAutoShareMedicalId(value) {
      setPreferences((current) => ({ ...current, autoShareMedicalId: value }));
    }

    function setVoiceSosEnabled(value) {
      setPreferences((current) => ({ ...current, voiceSosEnabled: value }));
    }

    function setDemoModeEnabled(value) {
      setPreferences((current) => ({ ...current, demoModeEnabled: value }));
    }

    function startIncidentSession({ trigger, location, triage, broadcastMessage }) {
      const sessionId = buildSessionId();
      const startedAt = Date.now();
      const nextSession = {
        sessionId,
        startedAt,
        trigger: trigger ?? 'SOS',
        location: normalizeLocation(location ?? currentLocation),
        triage: triage ?? latestTriageReport,
        broadcastMessage: broadcastMessage ?? buildBroadcastMessage({
          profile,
          location: location ?? currentLocation,
          triage: triage ?? latestTriageReport,
          contacts,
          sessionId,
          timestamp: startedAt,
        }),
      };

      const sessionMessage = buildBroadcastMessage({
        profile,
        location: nextSession.location,
        triage: nextSession.triage,
        contacts,
        sessionId: nextSession.sessionId,
        timestamp: nextSession.startedAt,
      });

      const nextSessionWithMessage = { ...nextSession, broadcastMessage: sessionMessage };
      setActiveIncident(nextSessionWithMessage);
      setLatestBroadcastMessage(sessionMessage);
      return nextSessionWithMessage;
    }

    function updateIncidentBroadcast(message) {
      setLatestBroadcastMessage(message);
      setActiveIncident((current) => (current ? { ...current, broadcastMessage: message } : current));
    }

    function completeIncidentSession(resolution = {}) {
      setActiveIncident((current) => {
        if (!current) return null;
        const nextReport = buildIncidentReport({
          activeIncident: current,
          profile,
          location: currentLocation,
          triage: current.triage ?? latestTriageReport,
          contacts,
          resolution,
        });
        setLatestIncidentReport(nextReport);
        setIncidentHistory((existing) => [nextReport, ...existing].slice(0, 10));
        setDemoFlowStep('idle');
        return null;
      });
    }

    function registerTriageReport(report, location = currentLocation) {
      setLatestTriageReport(report);
      setCurrentLocation(normalizeLocation(location));
      return report;
    }

    return {
      hydrated,
      profile,
      setProfile,
      contacts,
      setContacts,
      preferences,
      setAutoShareMedicalId,
      setVoiceSosEnabled,
      setDemoModeEnabled,
      currentLocation,
      setCurrentLocation,
      latestTriageReport,
      setLatestTriageReport,
      registerTriageReport,
      activeIncident,
      startIncidentSession,
      updateIncidentBroadcast,
      completeIncidentSession,
      latestIncidentReport,
      incidentHistory,
      latestBroadcastMessage,
      demoFlowStep,
      setDemoFlowStep,
    };
  }, [
    activeIncident,
    contacts,
    currentLocation,
    demoFlowStep,
    hydrated,
    incidentHistory,
    latestBroadcastMessage,
    latestIncidentReport,
    latestTriageReport,
    preferences,
    profile,
  ]);

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }

  return context;
}

export { buildBroadcastMessage, buildIncidentReport, buildSessionId, normalizeLocation };

