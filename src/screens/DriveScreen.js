import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { useAppContext } from '@/context/AppContext';
import { calculateRoadRisk } from '@/services/RiskEngine';
import { selectBestHospital } from '@/services/hospitalIntelligence';

const ROAD_LIMITS = {
  highway: 100,
  city: 50,
  residential: 30,
};

function haversineDistanceKm(a, b) {
  const earthRadiusKm = 6371;
  const latDelta = ((b.latitude - a.latitude) * Math.PI) / 180;
  const lonDelta = ((b.longitude - a.longitude) * Math.PI) / 180;
  const startLat = (a.latitude * Math.PI) / 180;
  const endLat = (b.latitude * Math.PI) / 180;
  const h = Math.sin(latDelta / 2) ** 2 + Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function roadTypeFromLocation(location) {
  if (!location) return 'city';
  const bucket = Math.abs(Math.round(location.latitude * 1000 + location.longitude * 1000)) % 3;
  return ['residential', 'city', 'highway'][bucket];
}

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
  const seconds = String(safe % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function GaugeNeedle({ value }) {
  const rotation = useMemo(() => `${-120 + Math.min(200, Math.max(0, value)) * 1.2}deg`, [value]);
  return <View style={[styles.needle, { transform: [{ rotate: rotation }] }]} />;
}

export default function DriveScreen() {
  const router = useRouter();
  const { currentLocation, setCurrentLocation, latestTriageReport, profile, preferences, demoFlowStep, setDemoFlowStep } = useAppContext();
  const [speed, setSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [roadRisk, setRoadRisk] = useState(null);
  const [driveStartedAt, setDriveStartedAt] = useState(null);
  const [riskEvents, setRiskEvents] = useState(0);
  const [drivingMode, setDrivingMode] = useState(false);
  const [weather, setWeather] = useState('clear');
  const [tripLabel, setTripLabel] = useState('Ready to drive');
  const [listeningMessage, setListeningMessage] = useState('GPS ready');
  const [overspeed, setOverspeed] = useState(false);
  const [currentRoadType, setCurrentRoadType] = useState('city');
  const [flashValue] = useState(new Animated.Value(0));
  const previousSampleRef = useRef(null);
  const watchRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setListeningMessage('Location permission denied');
          return;
        }

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const initialLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: currentLocation?.address ?? 'Lucknow, India',
          label: currentLocation?.label ?? 'Lucknow, India',
        };

        setCurrentLocation(initialLocation);
        previousSampleRef.current = { ...position.coords, timestamp: Date.now() };
        setCurrentRoadType(roadTypeFromLocation(initialLocation));
        setRoadRisk(await calculateRoadRisk(initialLocation).catch(() => null));

        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
          async (nextPosition) => {
            if (!mounted) return;

            const nextLocation = {
              latitude: nextPosition.coords.latitude,
              longitude: nextPosition.coords.longitude,
              address: currentLocation?.address ?? 'Lucknow, India',
              label: currentLocation?.label ?? 'Lucknow, India',
            };

            const previous = previousSampleRef.current;
            const timestamp = Date.now();
            let nextSpeed = Number(nextPosition.coords.speed ?? 0);

            if (previous) {
              const deltaSeconds = Math.max(1, (timestamp - previous.timestamp) / 1000);
              const deltaKm = haversineDistanceKm(previous, nextLocation);
              const computedSpeed = (deltaKm / deltaSeconds) * 3600;
              nextSpeed = Math.max(nextSpeed, computedSpeed);
              setDistanceKm((current) => current + deltaKm);
            }

            previousSampleRef.current = { ...nextLocation, timestamp };
            setCurrentLocation(nextLocation);
            setCurrentRoadType(roadTypeFromLocation(nextLocation));
            setRoadRisk(await calculateRoadRisk(nextLocation).catch(() => null));
            setSpeed(Number(nextSpeed.toFixed(1)));
            setMaxSpeed((current) => Math.max(current, Number(nextSpeed.toFixed(1))));
            setListeningMessage(nextSpeed > 20 ? 'Driving detected' : 'Monitoring speed');
          }
        );
      } catch (error) {
        setListeningMessage('GPS unavailable');
      }
    })();

    return () => {
      mounted = false;
      watchRef.current?.remove?.();
    };
  }, [currentLocation?.address, currentLocation?.label, setCurrentLocation]);

  useEffect(() => {
    const nextDrivingMode = speed > 20;
    setDrivingMode(nextDrivingMode);
    if (!driveStartedAt && nextDrivingMode) {
      setDriveStartedAt(Date.now());
      setTripLabel('Trip in progress');
    }
  }, [driveStartedAt, speed]);

  const roadLimit = ROAD_LIMITS[currentRoadType] ?? ROAD_LIMITS.city;
  const bestHospital = useMemo(() => selectBestHospital(currentLocation, latestTriageReport, profile?.bloodGroup), [currentLocation, latestTriageReport, profile?.bloodGroup]);
  const hospitalMinutes = bestHospital ? Math.max(3, Math.round(bestHospital.ambulanceEta)) : 0;
  const travelModeLabel = overspeed ? 'OVER SPEED' : drivingMode ? 'DRIVING' : 'IDLE';

  useEffect(() => {
    const nextOverspeed = speed > roadLimit;
    if (nextOverspeed && !overspeed) {
      Vibration.vibrate([0, 300, 80, 300]);
      Animated.sequence([
        Animated.timing(flashValue, { toValue: 1, duration: 120, useNativeDriver: false }),
        Animated.timing(flashValue, { toValue: 0, duration: 250, useNativeDriver: false }),
      ]).start();
      Speech.speak('Speed limit exceeded');
      setRiskEvents((current) => current + 1);
      setTripLabel('Speed warning triggered');
    }
    setOverspeed(nextOverspeed);
  }, [flashValue, roadLimit, speed, overspeed]);

  useEffect(() => {
    if (roadRisk?.weatherLabel) {
      setWeather(roadRisk.weatherLabel);
    }
  }, [roadRisk?.weatherLabel]);

  useEffect(() => {
    if (demoFlowStep === 'drive') {
      setDrivingMode(true);
      setSpeed(72);
      setMaxSpeed(72);
      setDistanceKm((current) => current + 3.2);
      setRiskEvents(1);
      setDemoFlowStep('voice');
      router.push('/home');
    }
  }, [demoFlowStep, router, setDemoFlowStep]);

  const tripDuration = driveStartedAt ? formatDuration((Date.now() - driveStartedAt) / 1000) : '00:00';
  const flashOpacity = flashValue.interpolate({ inputRange: [0, 1], outputRange: [0, 0.82] });

  return (
    <View style={styles.container}>
      <Animated.View pointerEvents="none" style={[styles.flashLayer, { opacity: flashOpacity }]} />

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Drive</Text>
          <Text style={styles.headerSub}>{listeningMessage}</Text>
        </View>
        <View style={[styles.modePill, drivingMode ? styles.modePillActive : styles.modePillIdle]}>
          <Text style={styles.modePillText}>{travelModeLabel}</Text>
        </View>
      </View>

      <View style={styles.gaugeCard}>
        <View style={styles.gaugeTopRow}>
          <Text style={styles.gaugeLabel}>Current speed</Text>
          <Text style={styles.gaugeLimit}>Limit {roadLimit} km/h</Text>
        </View>

        <View style={styles.gaugeWrap}>
          <View style={styles.gaugeRing}>
            <View style={styles.gaugeDial}>
              <GaugeNeedle value={speed} />
              <View style={styles.gaugeCenter}>
                <Text style={styles.speedValue}>{Math.round(speed)}</Text>
                <Text style={styles.speedUnit}>km/h</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Road type</Text>
            <Text style={styles.metricValue}>{currentRoadType}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Max speed</Text>
            <Text style={styles.metricValue}>{Math.round(maxSpeed)} km/h</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Distance</Text>
            <Text style={styles.metricValue}>{distanceKm.toFixed(2)} km</Text>
          </View>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Road risk</Text>
          <Text style={styles.infoValue}>{roadRisk ? `${roadRisk.riskLevel} (${roadRisk.riskScore.toFixed(1)}/10)` : 'Calculating'}</Text>
          <Text style={styles.infoSub}>{roadRisk?.weatherLabel ? `Weather: ${roadRisk.weatherLabel}` : 'Weather syncing'}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Nearest hospital</Text>
          <Text style={styles.infoValue}>{bestHospital ? bestHospital.name : 'Loading'}</Text>
          <Text style={styles.infoSub}>{hospitalMinutes ? `${hospitalMinutes} min by ambulance` : 'ETA pending'}</Text>
        </View>
      </View>

      <View style={styles.alertCard}>
        <Text style={styles.alertTitle}>Trip summary</Text>
        <Text style={styles.alertLine}>Start time: {driveStartedAt ? new Date(driveStartedAt).toLocaleTimeString() : 'Waiting to start'}</Text>
        <Text style={styles.alertLine}>Duration: {tripDuration}</Text>
        <Text style={styles.alertLine}>Risk events: {riskEvents}</Text>
        <Text style={styles.alertLine}>Current road risk: {roadRisk?.alerts?.[0] ?? 'Stable'}</Text>
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={[styles.actionButton, drivingMode && styles.actionButtonActive]} onPress={() => setDrivingMode((current) => !current)}>
          <Text style={styles.actionButtonText}>{drivingMode ? 'Driving Mode On' : 'I am Driving'}</Text>
        </Pressable>
        <Pressable style={styles.actionButtonSecondary} onPress={() => router.push('/home')}>
          <Text style={styles.actionButtonSecondaryText}>Open SOS</Text>
        </Pressable>
      </View>

      {drivingMode ? (
        <View style={styles.lockPanel}>
          <Text style={styles.lockTitle}>Driving mode lock</Text>
          <Text style={styles.lockBody}>Only the SOS shortcut stays visible while you are moving fast.</Text>
          <Pressable style={styles.sosButton} onPress={() => router.push('/home')}>
            <Text style={styles.sosButtonText}>SOS</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08111F', padding: 16, gap: 14 },
  flashLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#DC2626', zIndex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 },
  headerTitle: { color: '#fff', fontSize: 32, fontWeight: '900' },
  headerSub: { color: '#CBD5E1', marginTop: 4 },
  modePill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  modePillActive: { backgroundColor: '#991B1B' },
  modePillIdle: { backgroundColor: '#0F172A' },
  modePillText: { color: '#fff', fontWeight: '900', letterSpacing: 0.8 },
  gaugeCard: { backgroundColor: '#0D1729', borderRadius: 28, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', zIndex: 2 },
  gaugeTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gaugeLabel: { color: '#E5E7EB', fontSize: 16, fontWeight: '800' },
  gaugeLimit: { color: '#93C5FD', fontWeight: '800' },
  gaugeWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  gaugeRing: { width: 280, height: 280, borderRadius: 140, borderWidth: 12, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#09101D' },
  gaugeDial: { width: 230, height: 230, borderRadius: 115, borderWidth: 2, borderColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' },
  gaugeCenter: { position: 'absolute', bottom: 28, alignItems: 'center' },
  speedValue: { color: '#fff', fontSize: 56, fontWeight: '900', lineHeight: 60 },
  speedUnit: { color: '#CBD5E1', fontSize: 16, fontWeight: '800' },
  needle: { position: 'absolute', width: 4, height: 108, borderRadius: 2, backgroundColor: '#FDE68A', top: 18 },
  metricRow: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, backgroundColor: '#101C33', borderRadius: 18, padding: 12, gap: 4 },
  metricLabel: { color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  metricValue: { color: '#fff', fontSize: 16, fontWeight: '900' },
  infoGrid: { flexDirection: 'row', gap: 10, zIndex: 2 },
  infoCard: { flex: 1, backgroundColor: '#101C33', borderRadius: 20, padding: 14, gap: 6 },
  infoTitle: { color: '#93C5FD', textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 12, fontWeight: '900' },
  infoValue: { color: '#fff', fontSize: 15, fontWeight: '900' },
  infoSub: { color: '#CBD5E1', fontSize: 12, lineHeight: 17 },
  alertCard: { backgroundColor: '#0F172A', borderRadius: 22, padding: 14, gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  alertTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  alertLine: { color: '#CBD5E1', lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1, backgroundColor: '#E24B4A', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  actionButtonActive: { backgroundColor: '#B91C1C' },
  actionButtonText: { color: '#fff', fontWeight: '900' },
  actionButtonSecondary: { flex: 1, backgroundColor: '#0F172A', paddingVertical: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  actionButtonSecondaryText: { color: '#fff', fontWeight: '800' },
  lockPanel: { backgroundColor: '#DC2626', borderRadius: 24, padding: 18, alignItems: 'center', gap: 8 },
  lockTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  lockBody: { color: '#FFE4E6', textAlign: 'center', lineHeight: 20 },
  sosButton: { width: 128, height: 128, borderRadius: 64, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  sosButtonText: { color: '#DC2626', fontWeight: '900', fontSize: 24 },
});
