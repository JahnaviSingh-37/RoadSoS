import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function PermissionScreen() {
  const router = useRouter();
  const [permissionStatus, setPermissionStatus] = useState('unknown');

  async function requestLocationPermission() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.kicker}>SCREEN 2 OF 3</Text>
        <Text style={styles.title}>AI that thinks for you</Text>
        <Text style={styles.description}>
          We use your location to route emergency calls, fetch nearby services, and build offline
          safety cache around your home area.
        </Text>

        <View style={styles.animationCard}>
          <LottieView source={require('../../assets/lottie/pulse.json')} autoPlay loop style={styles.animation} />
          <Text style={styles.animationLabel}>Triage engine animation</Text>
        </View>

        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Permission status:</Text>
          <Text style={styles.statusValue}>{permissionStatus}</Text>
        </View>

        <Pressable style={styles.secondaryButton} onPress={requestLocationPermission}>
          <Text style={styles.secondaryButtonText}>Allow Location</Text>
        </Pressable>

        <Pressable style={styles.primaryButton} onPress={() => router.push('/onboarding/preferences')}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF7F7',
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 20,
    justifyContent: 'center',
    gap: 14,
  },
  kicker: { color: '#B45309', fontWeight: '900', letterSpacing: 1, fontSize: 12 },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
  animationCard: {
    borderRadius: 24,
    backgroundColor: '#0F172A',
    padding: 12,
    alignItems: 'center',
  },
  animation: { width: '100%', height: 170 },
  animationLabel: { color: '#CBD5E1', fontSize: 12, marginTop: 4, fontWeight: '700' },
  statusBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#F5D0D0',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  statusLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  statusValue: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E24B4A',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#E24B4A',
    fontWeight: '700',
    fontSize: 15,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: '#E24B4A',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
});
