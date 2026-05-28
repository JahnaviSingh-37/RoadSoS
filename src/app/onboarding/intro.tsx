import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import EmergencyMantra from '@/components/EmergencyMantra';

export default function IntroScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.kicker}>SCREEN 1 OF 3</Text>
        <Text style={styles.title}>In an emergency, every second counts</Text>
        <Text style={styles.subtitle}>Crash-aware rescue support built for India.</Text>
        <EmergencyMantra tone="light" />

        <View style={styles.animationCard}>
          <LottieView source={require('../../assets/lottie/pulse.json')} autoPlay loop style={styles.animation} />
          <Text style={styles.animationLabel}>Crash response animation</Text>
        </View>

        <View style={styles.featureList}>
          <Text style={styles.featureItem}>• One-tap SOS with 3-second hold</Text>
          <Text style={styles.featureItem}>• Live location tracking and shareable link</Text>
          <Text style={styles.featureItem}>• Nearby hospitals, police, and fire support</Text>
          <Text style={styles.featureItem}>• First-aid triage guidance in emergencies</Text>
          <Text style={styles.featureItem}>• Offline cached emergency services</Text>
        </View>

        <Pressable style={styles.primaryButton} onPress={() => router.push('/onboarding/permissions')}>
          <Text style={styles.primaryButtonText}>Get Started</Text>
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
    paddingVertical: 24,
    justifyContent: 'center',
    gap: 14,
  },
  kicker: { color: '#B45309', fontWeight: '900', letterSpacing: 1, fontSize: 12 },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 8,
  },
  animationCard: {
    borderRadius: 24,
    backgroundColor: '#0F172A',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: { width: '100%', height: 190 },
  animationLabel: { color: '#CBD5E1', fontSize: 12, marginTop: 4, fontWeight: '700' },
  featureList: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F5D0D0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 8,
  },
  featureItem: {
    fontSize: 14,
    color: '#334155',
  },
  primaryButton: {
    marginTop: 8,
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
