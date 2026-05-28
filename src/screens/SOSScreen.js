import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Linking, Platform, Pressable, Share, StyleSheet, Text, Vibration, View } from 'react-native';

import EmergencyMantra from '@/components/EmergencyMantra';
import { useAppContext } from '@/context/AppContext';
import { MOCK_INCIDENT_FEED } from '@/data/mockIncidents';

function countryToFlagEmoji(countryCode) {
      if (!countryCode) return '';
      return countryCode
        .toUpperCase()
        .split('')
        .map((c) => String.fromCodePoint(127397 + c.charCodeAt()))
        .join('');
    }

async function playBeep() {
  try {
    const sound = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
      { shouldPlay: true, volume: 0.8 }
    );
    setTimeout(() => sound.sound?.unloadAsync?.().catch(() => null), 2000);
  } catch {
    // Beep is best-effort for demo mode.
  }
}

    export default function SOSScreen() {
      const router = useRouter();
      const { currentLocation: contextLocation, setCurrentLocation, preferences, startIncidentSession, demoFlowStep, setDemoFlowStep } = useAppContext();
      const [location, setLocation] = useState(null);
      const [placemark, setPlacemark] = useState(null);
      const [gpsAvailable, setGpsAvailable] = useState(false);
      const [timeStr, setTimeStr] = useState(() => new Date().toLocaleTimeString());
      const [holding, setHolding] = useState(false);
      const holdTimerRef = useRef(null);
      const holdProgressRef = useRef(new Animated.Value(0));
      const pulseAnim = useRef(new Animated.Value(0)).current;
      const [expandedHelp, setExpandedHelp] = useState(false);
      const [selectedHelp, setSelectedHelp] = useState(null);
      const [demoMode, setDemoMode] = useState(false);
      const [lastIncidentAt, setLastIncidentAt] = useState(null);
      const [incidentIndex, setIncidentIndex] = useState(0);
      const tickerPulse = useRef(new Animated.Value(0)).current;
      const [voiceListening, setVoiceListening] = useState(false);
      const [voiceStatus, setVoiceStatus] = useState('Voice SOS off');
      const recognitionRef = useRef(null);
      const wakeWordHitsRef = useRef(0);
      const wakeWordWindowRef = useRef(null);
      const descriptionStopRef = useRef(null);
      const transcriptBufferRef = useRef('');

      useEffect(() => {
        // time updater
        const t = setInterval(() => setTimeStr(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(t);
      }, []);

      useEffect(() => {
        (async () => {
          try {
            const dm = await AsyncStorage.getItem('demoMode');
            setDemoMode(dm === 'true');
            const lastIncident = await AsyncStorage.getItem('lastIncidentAt');
            setLastIncidentAt(lastIncident ? Number(lastIncident) : null);

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
              setGpsAvailable(false);
              return;
            }

            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            setLocation(pos.coords);
            setCurrentLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              address: contextLocation?.address ?? 'Lucknow, India',
              label: contextLocation?.label ?? 'Lucknow, India',
            });
            setGpsAvailable(true);

            const pm = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            setPlacemark(pm?.[0] ?? null);

            const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 }, (p) => {
              setLocation(p.coords);
              setCurrentLocation({
                latitude: p.coords.latitude,
                longitude: p.coords.longitude,
                address: contextLocation?.address ?? 'Lucknow, India',
                label: contextLocation?.label ?? 'Lucknow, India',
              });
              setGpsAvailable(true);
            });

            return () => sub.remove();
          } catch (e) {
            setGpsAvailable(false);
          }
        })();
      }, []);

      useEffect(() => {
        if (!preferences.voiceSosEnabled || Platform.OS !== 'web') {
          return undefined;
        }

        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        if (!SpeechRecognition) {
          setVoiceStatus('Web Speech API unavailable');
          return undefined;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setVoiceListening(true);
          setVoiceStatus('Listening for HELP or SOS');
        };

        recognition.onerror = () => {
          setVoiceListening(false);
          setVoiceStatus('Voice SOS paused');
        };

        recognition.onend = () => {
          setVoiceListening(false);
          if (preferences.voiceSosEnabled) {
            try {
              recognition.start();
            } catch {
              setVoiceStatus('Voice SOS waiting');
            }
          }
        };

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0]?.transcript ?? '')
            .join(' ')
            .toUpperCase();

          transcriptBufferRef.current = transcript;
          const wakeHits = (transcript.match(/\b(HELP|SOS)\b/g) || []).length;

          if (wakeHits >= 3 && !wakeWordWindowRef.current) {
            wakeWordWindowRef.current = setTimeout(() => {
              wakeWordHitsRef.current = 0;
              wakeWordWindowRef.current = null;
            }, 8000);

            wakeWordHitsRef.current = wakeHits;
            void beginVoiceSOS();
          }
        };

        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {
          setVoiceStatus('Voice SOS waiting');
        }

        return () => {
          try {
            recognition.stop();
          } catch {
            // ignore
          }
          recognitionRef.current = null;
        };
      }, [preferences.voiceSosEnabled]);

      useEffect(() => {
        if (!preferences.demoModeEnabled || demoFlowStep !== 'voice') {
          return undefined;
        }

        const timer = setTimeout(() => {
          void beginVoiceSOS();
        }, 1000);

        return () => clearTimeout(timer);
      }, [demoFlowStep, preferences.demoModeEnabled]);

      useEffect(() => {
        // pulsing animation for SOS outer ring & gps dot
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
          ])
        ).start();
      }, [pulseAnim]);

      useEffect(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(tickerPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
            Animated.timing(tickerPulse, { toValue: 0, duration: 900, useNativeDriver: true }),
          ])
        ).start();

        const t = setInterval(() => {
          setIncidentIndex((current) => (current + 1) % MOCK_INCIDENT_FEED.length);
        }, 3500);

        return () => clearInterval(t);
      }, [tickerPulse]);

      function startHold() {
        setHolding(true);
        holdProgressRef.current.setValue(0);
        Animated.timing(holdProgressRef.current, { toValue: 1, duration: 3000, useNativeDriver: false }).start();
        holdTimerRef.current = setTimeout(() => onActivateSOS(), 3000);
      }

      function cancelHold() {
        setHolding(false);
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        Animated.timing(holdProgressRef.current, { toValue: 0, duration: 200, useNativeDriver: false }).start();
      }

      function buildEmergencyQuery(description = '') {
        const lat = location?.latitude;
        const lng = location?.longitude;
        const queryParts = [];
        if (lat != null && lng != null) queryParts.push(`lat=${lat}`);
        if (lat != null && lng != null) queryParts.push(`lng=${lng}`);
        if (description) queryParts.push(`voice=${encodeURIComponent(description)}`);
        queryParts.push('source=voice-sos');
        return queryParts.join('&');
      }

      function routeToTriage(description = '') {
        const query = buildEmergencyQuery(description);
        router.push(`/triage-ai?${query}`);
      }

      async function beginVoiceSOS() {
        setVoiceStatus('Voice SOS activated — say your emergency');
        Vibration.vibrate([0, 350, 150, 350]);
        void playBeep();
        AsyncStorage.setItem('lastIncidentAt', String(Date.now())).catch(() => null);
        startIncidentSession({
          trigger: 'Voice SOS',
          location: {
            latitude: location?.latitude,
            longitude: location?.longitude,
            address: placemark?.name ? `${placemark.name}, Lucknow` : 'Lucknow, India',
            label: 'Lucknow, India',
          },
        });

        try {
          recognitionRef.current?.stop?.();
        } catch {
          // ignore
        }

        const SpeechRecognition = Platform.OS === 'web' ? window.webkitSpeechRecognition || window.SpeechRecognition : null;
        if (!SpeechRecognition) {
          routeToTriage('voice sos activated');
          return;
        }

        const descriptionRecognition = new SpeechRecognition();
        descriptionRecognition.continuous = true;
        descriptionRecognition.interimResults = true;
        descriptionRecognition.lang = 'en-US';
        const transcriptParts = [];

        descriptionRecognition.onresult = (event) => {
          const text = Array.from(event.results)
            .map((result) => result[0]?.transcript ?? '')
            .join(' ')
            .trim();
          if (text) {
            transcriptParts.push(text);
          }
        };

        descriptionRecognition.start();
        descriptionStopRef.current = setTimeout(() => {
          try {
            descriptionRecognition.stop();
          } catch {
            // ignore
          }
          const description = transcriptParts.join(' ').trim() || 'Voice SOS, emergency assistance needed.';
          setVoiceStatus('Routing to triage');
          routeToTriage(description);
        }, 10000);
      }

      function onActivateSOS() {
        setHolding(false);
        Vibration.vibrate(500);
        AsyncStorage.setItem('lastIncidentAt', String(Date.now())).catch(() => null);
        startIncidentSession({
          trigger: 'Button SOS',
          location: {
            latitude: location?.latitude,
            longitude: location?.longitude,
            address: placemark?.name ? `${placemark.name}, Lucknow` : 'Lucknow, India',
            label: 'Lucknow, India',
          },
        });
        const lat = location?.latitude;
        const lng = location?.longitude;
        const query = lat != null && lng != null ? `?lat=${lat}&lng=${lng}&source=button-sos` : '?source=button-sos';
        router.push(`/triage-ai${query}`);
      }

      async function quickCall(number) {
        try {
          const url = `tel:${number}`;
          await Linking.openURL(url);
        } catch (e) {
          Alert.alert('Unable to call', `Could not call ${number}`);
        }
      }

      async function onShareLocation() {
        try {
          const text = location ? `My location: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'Location unknown';
          await Share.share({ message: text });
        } catch (e) {}
      }

      const helpTips = {
        Accident: 'Stop, check for danger, call emergency services. Do not move injured person unless necessary.',
        Medical: 'Check responsiveness, open airway, perform CPR if needed and trained.',
        Fire: 'Move to safety, call fire services, avoid smoke inhalation.',
        Crime: 'Get to safe place, call police, provide location and details.'
      };

      const city = placemark?.city || placemark?.name || '';
      const countryCode = placemark?.isoCountryCode || '';

      const progressWidth = holdProgressRef.current.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

      return (
        <View style={styles.container}>
          {demoMode && (
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>DEMO MODE</Text>
            </View>
          )}

          <View style={styles.topBar}>
            <View style={styles.gpsStatusRow}>
              <Animated.View
                style={[
                  styles.gpsDotOuter,
                  gpsAvailable && { opacity: pulseAnim.interpolate({ inputRange: [0,1], outputRange: [0.4, 1] }) },
                ]}
              >
                <View style={[styles.gpsDotInner, gpsAvailable ? styles.gpsGreen : styles.gpsGray]} />
              </Animated.View>
              <Text style={styles.topTime}>{timeStr}</Text>
            </View>

            <View style={styles.voiceRow}>
              <View style={[styles.voiceDot, preferences.voiceSosEnabled ? styles.voiceDotActive : styles.voiceDotInactive]} />
              <Ionicons name="mic" size={16} color={preferences.voiceSosEnabled ? '#22C55E' : '#EF4444'} />
              <Text style={styles.voiceLabel}>{preferences.voiceSosEnabled ? (voiceListening ? 'listening' : 'armed') : 'off'}</Text>
            </View>

            <View style={styles.batteryIcon}>
              <View style={styles.batCell} />
              <View style={styles.batCell} />
              <View style={[styles.batCell, styles.batWeak]} />
              <View style={styles.batTip} />
            </View>
          </View>

          <View style={styles.voiceBanner}>
            <Text style={styles.voiceBannerTitle}>Voice SOS</Text>
            <Text style={styles.voiceBannerText}>{voiceStatus}</Text>
          </View>

          <View style={styles.locationCard}>
            <Text style={styles.locationTitle}>
              {city} {countryToFlagEmoji(countryCode)}
            </Text>
            <Text style={styles.coordsText}>
              {location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'Location unavailable'}
            </Text>
            <EmergencyMantra tone="dark" />
          </View>

          <View style={styles.sosContainer}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseAnim.interpolate({ inputRange: [0,1], outputRange: [1, 1.18] }) }],
                  opacity: pulseAnim.interpolate({ inputRange: [0,1], outputRange: [0.45, 0.9] }),
                },
              ]}
            />

            <Pressable
              onPressIn={startHold}
              onPressOut={cancelHold}
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              style={styles.sosButtonWrapper}
              accessibilityLabel="SOS Hold Button"
            >
              <View style={styles.sosButtonInner}>
                <Text style={styles.sosText}>SOS</Text>
              </View>
            </Pressable>

            <Animated.View style={[styles.holdProgress, { width: progressWidth }]} />

            <Text style={styles.holdLabel}>Hold 3 seconds to activate</Text>
          </View>

          <View style={styles.quickGrid}>
            <Pressable style={styles.quickItem} onPress={() => quickCall('108')}>
              <Text style={styles.quickIcon}>🚑</Text>
              <Text style={styles.quickLabel}>Ambulance</Text>
              <Text style={styles.quickNumber}>108</Text>
            </Pressable>

            <Pressable style={styles.quickItem} onPress={() => quickCall('100')}>
              <Text style={styles.quickIcon}>🚔</Text>
              <Text style={styles.quickLabel}>Police</Text>
              <Text style={styles.quickNumber}>100</Text>
            </Pressable>

            <Pressable style={styles.quickItem} onPress={() => quickCall('101')}>
              <Text style={styles.quickIcon}>🚒</Text>
              <Text style={styles.quickLabel}>Fire</Text>
              <Text style={styles.quickNumber}>101</Text>
            </Pressable>

            <Pressable style={styles.quickItem} onPress={onShareLocation}>
              <Text style={styles.quickIcon}>📍</Text>
              <Text style={styles.quickLabel}>Share Location</Text>
              <Text style={styles.quickNumber}>—</Text>
            </Pressable>
          </View>

          {lastIncidentAt ? (
            <View style={styles.recoveryCard}>
              <Text style={styles.recoveryTitle}>Recovery check</Text>
              <Text style={styles.recoveryCopy}>
                You had an incident {Math.max(1, Math.round((Date.now() - lastIncidentAt) / 86400000))} days ago. Are you recovered?
              </Text>
              <View style={styles.recoveryActions}>
                <Pressable
                  style={[styles.recoveryButton, styles.recoveryButtonYes]}
                  onPress={() => {
                    setLastIncidentAt(null);
                    AsyncStorage.removeItem('lastIncidentAt').catch(() => null);
                  }}
                >
                  <Text style={styles.recoveryButtonText}>Yes</Text>
                </Pressable>
                <Pressable
                  style={[styles.recoveryButton, styles.recoveryButtonHelp]}
                  onPress={() => router.push('/nearby')}
                >
                  <Text style={styles.recoveryButtonText}>Still need help</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.incidentFeedCard}>
            <View style={styles.incidentFeedHeader}>
              <Text style={styles.incidentFeedTitle}>Live incident feed</Text>
              <Animated.Text style={[styles.incidentFeedPulse, { opacity: tickerPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]}>
                {MOCK_INCIDENT_FEED[incidentIndex].severity === 'high' ? 'LIVE' : 'UPDATING'}
              </Animated.Text>
            </View>
            <Animated.View style={{ opacity: tickerPulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) }}>
              <Text style={styles.incidentFeedText}>
                {MOCK_INCIDENT_FEED[incidentIndex].emoji} {MOCK_INCIDENT_FEED[incidentIndex].title} — {MOCK_INCIDENT_FEED[incidentIndex].area} — {MOCK_INCIDENT_FEED[incidentIndex].minutesAgo} min ago
              </Text>
            </Animated.View>
          </View>

          <View style={styles.bottomPanel}>
            <Pressable onPress={() => setExpandedHelp(!expandedHelp)} style={styles.bottomHeader}>
              <Text style={styles.bottomTitle}>I need help with...</Text>
              <Text style={styles.bottomToggle}>{expandedHelp ? 'Hide' : 'Show'}</Text>
            </Pressable>

            {expandedHelp && (
              <View style={styles.helpContent}>
                <View style={styles.chipsRow}>
                  {Object.keys(helpTips).map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => setSelectedHelp(k)}
                      style={[styles.chip, selectedHelp === k && styles.chipActive]}
                    >
                      <Text style={styles.chipText}>{k}</Text>
                    </Pressable>
                  ))}
                </View>

                {selectedHelp && (
                  <View style={styles.tipCard}>
                    <Text style={styles.tipText}>{helpTips[selectedHelp]}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      );
    }

    const styles = StyleSheet.create({
      container: { flex: 1, backgroundColor: '#0a0f1e', padding: 16 },
      topBar: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
      gpsStatusRow: { flexDirection: 'row', alignItems: 'center' },
      gpsDotOuter: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
      gpsDotInner: { width: 10, height: 10, borderRadius: 5 },
      gpsGreen: { backgroundColor: '#34D399' },
      gpsGray: { backgroundColor: '#6B7280' },
      voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
      voiceDot: { width: 8, height: 8, borderRadius: 4 },
      voiceDotActive: { backgroundColor: '#22C55E' },
      voiceDotInactive: { backgroundColor: '#EF4444' },
      voiceLabel: { color: '#E2E8F0', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
      voiceBanner: { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1F2937' },
      voiceBannerTitle: { color: '#fff', fontWeight: '900', fontSize: 13 },
      voiceBannerText: { color: '#CBD5E1', fontSize: 12, marginTop: 2 },
      topTime: { color: '#fff', fontSize: 16, fontWeight: '600' },
      batteryIcon: { flexDirection: 'row', alignItems: 'center' },
      batCell: { width: 8, height: 16, backgroundColor: '#9CA3AF', marginLeft: 2, borderRadius: 2 },
      batWeak: { backgroundColor: '#F59E0B' },
      batTip: { width: 4, height: 8, backgroundColor: '#9CA3AF', marginLeft: 4, borderRadius: 2 },

      locationCard: { backgroundColor: '#1a2035', marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#111827' },
      locationTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
      coordsText: { color: '#D1D5DB', marginTop: 6, fontSize: 14 },

      sosContainer: { alignItems: 'center', marginTop: 18, marginBottom: 8 },
      pulseRing: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 12, borderColor: 'rgba(204,0,0,0.12)', alignSelf: 'center' },
      sosButtonWrapper: { zIndex: 3 },
      sosButtonInner: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#CC0000', alignItems: 'center', justifyContent: 'center', elevation: 4 },
      sosText: { color: '#fff', fontSize: 28, fontWeight: '800' },
      holdLabel: { color: '#E5E7EB', marginTop: 10, fontSize: 16 },
      holdProgress: { height: 6, backgroundColor: '#E24B4A', borderRadius: 4, marginTop: 8, alignSelf: 'stretch' },

      quickGrid: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
      quickItem: { width: '48%', backgroundColor: '#111827', padding: 12, borderRadius: 10, marginBottom: 12, alignItems: 'center' },
      quickIcon: { fontSize: 36 },
      quickLabel: { color: '#fff', fontSize: 18, marginTop: 6 },
      quickNumber: { color: '#9CA3AF', marginTop: 4 },

      recoveryCard: { marginTop: 4, backgroundColor: '#111827', borderRadius: 14, padding: 12, gap: 8 },
      recoveryTitle: { color: '#fff', fontSize: 15, fontWeight: '900' },
      recoveryCopy: { color: '#D1D5DB', fontSize: 13, lineHeight: 18 },
      recoveryActions: { flexDirection: 'row', gap: 10 },
      recoveryButton: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
      recoveryButtonYes: { backgroundColor: '#16A34A' },
      recoveryButtonHelp: { backgroundColor: '#1D4ED8' },
      recoveryButtonText: { color: '#fff', fontWeight: '800' },

      incidentFeedCard: { marginTop: 4, backgroundColor: '#0F172A', borderRadius: 14, padding: 12, gap: 8 },
      incidentFeedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
      incidentFeedTitle: { color: '#fff', fontSize: 15, fontWeight: '900' },
      incidentFeedPulse: { color: '#FDE68A', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
      incidentFeedText: { color: '#E2E8F0', fontSize: 13, lineHeight: 18 },

      bottomPanel: { marginTop: 6, backgroundColor: 'transparent' },
      bottomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
      bottomTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
      bottomToggle: { color: '#9CA3AF' },
      helpContent: { marginTop: 8 },
      chipsRow: { flexDirection: 'row', justifyContent: 'space-between' },
      chip: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#111827', borderRadius: 8, marginRight: 8 },
      chipActive: { backgroundColor: '#23304a' },
      chipText: { color: '#fff', fontSize: 16 },
      tipCard: { marginTop: 10, backgroundColor: '#111827', padding: 12, borderRadius: 8 },
      tipText: { color: '#E5E7EB', fontSize: 16 },

      demoBadge: { position: 'absolute', right: 18, top: 10, backgroundColor: '#FF8C00', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, zIndex: 10 },
      demoBadgeText: { color: '#fff', fontWeight: '700' },
});
