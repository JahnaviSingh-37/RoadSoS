import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// avoids prop-drilling location + sos state to every screen
const AppContext = createContext(null);

export const DEFAULT_PROFILE = {
  name: 'Aarav Verma',
  bloodGroup: 'B+',
  conditions: 'Asthma, allergy to penicillin',
  address: 'Lucknow, India',
};

export const DEFAULT_CONTACTS = [
  { name: 'Priya Verma', relation: 'Spouse', phone: '+91 98765 43210' },
  { name: 'Rohan Verma', relation: 'Brother', phone: '+91 98111 22334' },
  { name: 'Dr. Meera Singh', relation: 'Family Doctor', phone: '+91 90000 11223' },
];

export const DEFAULT_LOCATION = {
  latitude: 26.8467,
  longitude: 80.9462,
  address: 'Lucknow, India',
};

const DEFAULTS = {
  profile: DEFAULT_PROFILE,
  contacts: DEFAULT_CONTACTS,
  location: DEFAULT_LOCATION,
  prefs: { autoShare: true, voiceSos: false, demoMode: false },
};

const STORAGE = {
  profile: 'ros_profile',
  contacts: 'ros_contacts',
  location: 'ros_location',
  prefs: 'ros_prefs',
  triage: 'ros_triage',
  incident: 'ros_incident',
  history: 'ros_history',
};

function safeParse(json, fallback) {
  try {
    return json ? JSON.parse(json) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeLoc(loc) {
  if (!loc) return DEFAULTS.location;
  return {
    latitude: Number(loc.latitude ?? DEFAULTS.location.latitude),
    longitude: Number(loc.longitude ?? DEFAULTS.location.longitude),
    address: loc.address ?? DEFAULTS.location.address,
  };
}

function buildSessionId() {
  return `SOS-${Date.now().toString(36).toUpperCase()}`;
}

export function AppProvider({ children }) {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState(DEFAULTS.profile);
  const [contacts, setContacts] = useState(DEFAULTS.contacts);
  const [prefs, setPrefs] = useState(DEFAULTS.prefs);
  const [loc, setLoc] = useState(DEFAULTS.location);
  const [triage, setTriage] = useState(null);
  const [incident, setIncident] = useState(null);
  const [history, setHistory] = useState([]);
  const [demoStep, setDemoStep] = useState('idle');

  useEffect(() => {
    let ok = true;
    (async () => {
      const [p, c, l, pr, t, inc, h] = await Promise.all([
        AsyncStorage.getItem(STORAGE.profile),
        AsyncStorage.getItem(STORAGE.contacts),
        AsyncStorage.getItem(STORAGE.location),
        AsyncStorage.getItem(STORAGE.prefs),
        AsyncStorage.getItem(STORAGE.triage),
        AsyncStorage.getItem(STORAGE.incident),
        AsyncStorage.getItem(STORAGE.history),
      ]);

      if (!ok) return;
      if (p) setProfile(safeParse(p, DEFAULTS.profile));
      if (c) setContacts(safeParse(c, DEFAULTS.contacts));
      if (l) setLoc(normalizeLoc(safeParse(l, DEFAULTS.location)));
      if (pr) setPrefs(safeParse(pr, DEFAULTS.prefs));
      if (t) setTriage(safeParse(t, null));
      if (inc) setIncident(safeParse(inc, null));
      if (h) setHistory(safeParse(h, []));
      setHydrated(true);
    })().catch(() => {
      if (ok) setHydrated(true);
    });
    return () => { ok = false; };
  }, []);

  // Persist to storage
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE.profile, JSON.stringify(profile)).catch(() => {});
  }, [hydrated, profile]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE.contacts, JSON.stringify(contacts)).catch(() => {});
  }, [hydrated, contacts]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE.location, JSON.stringify(loc)).catch(() => {});
  }, [hydrated, loc]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE.prefs, JSON.stringify(prefs)).catch(() => {});
  }, [hydrated, prefs]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE.triage, JSON.stringify(triage)).catch(() => {});
  }, [hydrated, triage]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE.incident, JSON.stringify(incident)).catch(() => {});
  }, [hydrated, incident]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE.history, JSON.stringify(history)).catch(() => {});
  }, [hydrated, history]);

  const value = useMemo(() => ({
    hydrated,
    profile,
    setProfile,
    contacts,
    setContacts,
    currentLocation: loc,
    setCurrentLocation: (l) => setLoc(normalizeLoc(l)),
    preferences: prefs,
    setAutoShareMedicalId: (v) => setPrefs(p => ({ ...p, autoShare: v })),
    setVoiceSosEnabled: (v) => setPrefs(p => ({ ...p, voiceSos: v })),
    setDemoModeEnabled: (v) => setPrefs(p => ({ ...p, demoMode: v })),
    latestTriageReport: triage,
    setLatestTriageReport: setTriage,
    activeIncident: incident,
    latestIncidentReport: incident,
    incidentHistory: history,
    demoFlowStep: demoStep,
    setDemoFlowStep: setDemoStep,
    startIncidentSession: (data) => {
      const sess = {
        sessionId: buildSessionId(),
        startedAt: Date.now(),
        trigger: data?.trigger ?? 'SOS',
        location: normalizeLoc(data?.location ?? loc),
      };
      setIncident(sess);
      return sess;
    },
    completeIncidentSession: () => {
      setIncident(null);
      setDemoStep('idle');
    },
  }), [hydrated, profile, contacts, prefs, loc, triage, incident, history, demoStep]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be inside AppProvider');
  return ctx;
}

