import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Pressable, Share, StyleSheet, Text, Vibration, View } from 'react-native';

import { useAppContext } from '@/context/AppContext';
import { MOCK_INCIDENT_FEED } from '@/data/mockIncidents';
import { startEmergencyFlow } from '@/services/emergencyOrchestrator';

const FLAG_MAP = { IN: '🇮🇳', US: '🇺🇸', GB: '🇬🇧' };

export default function SOSScreen() {
  const router = useRouter();
  const { startIncidentSession } = useAppContext();
  
  const [loc, setLoc] = useState(null);
  const [pm, setPm] = useState(null);
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [holding, setHolding] = useState(false);
  const [help, setHelp] = useState(null);
  const [demo, setDemo] = useState(false);
  const [lastSOS, setLastSOS] = useState(null);
  const [idx, setIdx] = useState(0);

  const holdRef = useRef(null);
  const holdProg = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const ticker = useRef(new Animated.Value(0)).current;

  // Update clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  // Setup GPS & location
  useEffect(() => {
    (async () => {
      try {
        const dm = await AsyncStorage.getItem('demoMode');
        setDemo(dm === 'true');
        const last = await AsyncStorage.getItem('lastIncidentAt');
        if (last) setLastSOS(Number(last));

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLoc(pos.coords);

        const geocode = await Location.reverseGeocodeAsync(pos.coords).catch(() => null);
        if (geocode?.[0]) setPm(geocode[0]);

        // Watch for updates
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10 },
          (p) => setLoc(p.coords)
        );
        return () => sub.remove();
      } catch (e) {
        // GPS unavailable
      }
    })();
  }, []);

  // Pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  // Incident feed ticker
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(ticker, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(ticker, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    const t = setInterval(() => {
      setIdx((i) => (i + 1) % MOCK_INCIDENT_FEED.length);
    }, 3500);
    return () => clearInterval(t);
  }, [ticker]);

  function onHoldStart() {
    setHolding(true);
    holdProg.setValue(0);
    Animated.timing(holdProg, { toValue: 1, duration: 3000, useNativeDriver: false }).start();
    holdRef.current = setTimeout(() => onActivateSOS(), 3000);
  }

  function onHoldEnd() {
    setHolding(false);
    if (holdRef.current) clearTimeout(holdRef.current);
    Animated.timing(holdProg, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  }

  async function onActivateSOS() {
    onHoldEnd();
    Vibration.vibrate(500);
    
    const incident = {
      trigger: 'Button SOS',
      location: {
        latitude: loc?.latitude ?? 26.8467,
        longitude: loc?.longitude ?? 80.9462,
        address: pm?.name ? `${pm.name}, Lucknow` : 'Lucknow, India',
      },
    };

    startIncidentSession(incident);
    AsyncStorage.setItem('lastIncidentAt', String(Date.now())).catch(() => {});
    
    const query = loc ? `?lat=${loc.latitude}&lng=${loc.longitude}&source=button` : '?source=button';
    router.push(`/triage-ai${query}`);
  }

  async function onQuickCall(num) {
    try {
      await Linking.openURL(`tel:${num}`);
    } catch (e) {}
  }

  async function onShareLoc() {
    try {
      const text = loc 
        ? `📍 My location: ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`
        : 'Location unavailable';
      await Share.share({ message: text });
    } catch (e) {}
  }

  const city = pm?.city || pm?.name || 'Unknown';
  const flag = FLAG_MAP[pm?.isoCountryCode] || '📍';
  const feed = MOCK_INCIDENT_FEED[idx];
  const width = holdProg.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={s.root}>
      {demo && <View style={s.demoBadge}><Text style={s.demoText}>DEMO</Text></View>}

      <View style={s.topBar}>
        <View style={s.gpsRow}>
          <View style={[s.gpsDot, { backgroundColor: loc ? '#10B981' : '#6B7280' }]} />
          <Text style={s.time}>{time}</Text>
        </View>
      </View>

      <View style={s.locCard}>
        <Text style={s.locTitle}>{city} {flag}</Text>
        <Text style={s.coords}>
          {loc ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}` : 'GPS connecting...'}
        </Text>
      </View>

      <View style={s.sosBox}>
        <Animated.View
          style={[
            s.pulseRing,
            {
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] }),
            },
          ]}
        />

        <Pressable
          onPressIn={onHoldStart}
          onPressOut={onHoldEnd}
          onMouseDown={onHoldStart}
          onMouseUp={onHoldEnd}
          onMouseLeave={onHoldEnd}
          style={s.sosBtn}
        >
          <Text style={s.sosText}>SOS</Text>
        </Pressable>

        <Animated.View style={[s.progBar, { width }]} />
        <Text style={s.hint}>Hold 3 sec</Text>
      </View>

      <View style={s.grid}>
        <Pressable style={s.card} onPress={() => onQuickCall('108')}>
          <Text style={s.icon}>🚑</Text>
          <Text style={s.label}>Ambulance</Text>
          <Text style={s.num}>108</Text>
        </Pressable>

        <Pressable style={s.card} onPress={() => onQuickCall('100')}>
          <Text style={s.icon}>🚔</Text>
          <Text style={s.label}>Police</Text>
          <Text style={s.num}>100</Text>
        </Pressable>

        <Pressable style={s.card} onPress={() => onQuickCall('101')}>
          <Text style={s.icon}>🚒</Text>
          <Text style={s.label}>Fire</Text>
          <Text style={s.num}>101</Text>
        </Pressable>

        <Pressable style={s.card} onPress={onShareLoc}>
          <Text style={s.icon}>📍</Text>
          <Text style={s.label}>Share Loc</Text>
          <Text style={s.num}>—</Text>
        </Pressable>
      </View>

      {lastSOS && (
        <View style={s.recovery}>
          <Text style={s.recoveryTitle}>Recovery</Text>
          <Text style={s.recoveryCopy}>
            You had an incident {Math.max(1, Math.round((Date.now() - lastSOS) / 86400000))} days ago.
          </Text>
          <View style={s.recButtons}>
            <Pressable
              style={[s.btn, { backgroundColor: '#10B981' }]}
              onPress={() => {
                setLastSOS(null);
                AsyncStorage.removeItem('lastIncidentAt').catch(() => {});
              }}
            >
              <Text style={s.btnText}>Yes, recovered</Text>
            </Pressable>
            <Pressable
              style={[s.btn, { backgroundColor: '#1D4ED8' }]}
              onPress={() => router.push('/nearby')}
            >
              <Text style={s.btnText}>Need help</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={s.feedCard}>
        <View style={s.feedHeader}>
          <Text style={s.feedTitle}>Live feed</Text>
          <Animated.Text style={[s.feedPulse, { opacity: ticker }]}>LIVE</Animated.Text>
        </View>
        <Animated.Text style={[s.feedText, { opacity: ticker }]}>
          {feed.emoji} {feed.title} — {feed.area}
        </Animated.Text>
      </View>

      <View style={s.helpPanel}>
        <Pressable onPress={() => setHelp(!help)} style={s.helpHeader}>
          <Text style={s.helpTitle}>Help with...</Text>
          <Text style={s.toggle}>{help ? 'Hide' : 'Show'}</Text>
        </Pressable>

        {help && (
          <View style={s.tips}>
            <Pressable style={s.chip} onPress={() => {}}>
              <Text style={s.chipText}>Accident</Text>
            </Pressable>
            <Pressable style={s.chip} onPress={() => {}}>
              <Text style={s.chipText}>Medical</Text>
            </Pressable>
            <Pressable style={s.chip} onPress={() => {}}>
              <Text style={s.chipText}>Fire</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0F1E', padding: 16 },
  demoBadge: { position: 'absolute', right: 16, top: 10, backgroundColor: '#FF8C00', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, zIndex: 10 },
  demoText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141D2F', borderRadius: 10, padding: 12, marginBottom: 12 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gpsDot: { width: 10, height: 10, borderRadius: 5 },
  time: { color: '#fff', fontSize: 14, fontWeight: '600' },

  locCard: { backgroundColor: '#141D2F', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#1E2A3D' },
  locTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  coords: { color: '#8892A4', fontSize: 12, marginTop: 4 },

  sosBox: { alignItems: 'center', marginVertical: 20 },
  pulseRing: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 12, borderColor: 'rgba(204,0,0,0.12)' },
  sosBtn: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#CC0000', alignItems: 'center', justifyContent: 'center', zIndex: 2, elevation: 8 },
  sosText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  progBar: { height: 6, backgroundColor: '#E24B4A', borderRadius: 4, marginTop: 12, alignSelf: 'stretch' },
  hint: { color: '#8892A4', fontSize: 13, marginTop: 8, fontWeight: '500' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  card: { width: '48%', backgroundColor: '#141D2F', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1E2A3D' },
  icon: { fontSize: 36 },
  label: { color: '#fff', fontSize: 14, marginTop: 8, fontWeight: '600' },
  num: { color: '#8892A4', fontSize: 12, marginTop: 4 },

  recovery: { backgroundColor: '#141D2F', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#1E2A3D' },
  recoveryTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  recoveryCopy: { color: '#8892A4', fontSize: 13, marginTop: 8, lineHeight: 18 },
  recButtons: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  feedCard: { backgroundColor: '#0F172A', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#1E2A3D' },
  feedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  feedTitle: { color: '#fff', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  feedPulse: { color: '#FFB800', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  feedText: { color: '#E2E8F0', fontSize: 13, lineHeight: 18 },

  helpPanel: { backgroundColor: 'transparent', marginBottom: 12 },
  helpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  helpTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  toggle: { color: '#8892A4', fontSize: 12 },
  tips: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#141D2F', borderRadius: 8, borderWidth: 1, borderColor: '#1E2A3D' },
  chipText: { color: '#fff', fontSize: 12 },
});
