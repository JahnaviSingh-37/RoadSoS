import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import {
    fetchAndCacheNearbyForHome,
    registerNightlyNearbyRefreshTask,
    saveHomeLocation,
} from '@/services/nearbyOfflineService';
import { completeOnboarding } from '@/services/onboardingService';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const LANGUAGES = ['English', 'Hindi', 'Spanish'];

export default function PreferencesScreen() {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [homeLocation, setHomeLocation] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSetHomeLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow location to set home location.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setHomeLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      Alert.alert('Unable to set location', 'Please try again to fetch home location.');
    }
  }

  async function finishOnboarding() {
    if (!homeLocation) {
      Alert.alert('Set home location', 'Please set your home location before finishing onboarding.');
      return;
    }

    try {
      setSaving(true);

      await saveHomeLocation(homeLocation);
      await completeOnboarding({ language: selectedLanguage });
      await registerNightlyNearbyRefreshTask();

      // Trigger background prefetch of 50km offline services without blocking navigation.
      setTimeout(() => {
        void fetchAndCacheNearbyForHome(homeLocation, GOOGLE_PLACES_API_KEY);
      }, 0);

      router.replace('/home');
    } catch {
      Alert.alert('Setup failed', 'Could not finish onboarding. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.kicker}>SCREEN 3 OF 3</Text>
        <Text style={styles.title}>Works even offline</Text>
        <Text style={styles.description}>
          Set a home location for offline caching and choose your preferred language.
        </Text>

        <View style={styles.animationCard}>
          <LottieView source={require('../../assets/lottie/pulse.json')} autoPlay loop style={styles.animation} />
          <Text style={styles.animationLabel}>Signal-loss fallback animation</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Home location</Text>
          {homeLocation ? (
            <Text style={styles.locationText}>
              {homeLocation.latitude.toFixed(5)}, {homeLocation.longitude.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.locationPlaceholder}>No home location selected yet.</Text>
          )}

          <Pressable style={styles.secondaryButton} onPress={handleSetHomeLocation}>
            <Text style={styles.secondaryButtonText}>Use Current Location</Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Language</Text>
          <View style={styles.languageRow}>
            {LANGUAGES.map((language) => {
              const selected = selectedLanguage === language;
              return (
                <Pressable
                  key={language}
                  style={[styles.languageChip, selected && styles.languageChipActive]}
                  onPress={() => setSelectedLanguage(language)}>
                  <Text style={[styles.languageChipText, selected && styles.languageChipTextActive]}>
                    {language}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable style={styles.primaryButton} onPress={finishOnboarding} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Finish</Text>
          )}
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
    marginBottom: 4,
  },
  animationCard: {
    borderRadius: 24,
    backgroundColor: '#0F172A',
    padding: 12,
    alignItems: 'center',
  },
  animation: { width: '100%', height: 170 },
  animationLabel: { color: '#CBD5E1', fontSize: 12, marginTop: 4, fontWeight: '700' },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#F5D0D0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  locationText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  locationPlaceholder: {
    color: '#64748B',
  },
  secondaryButton: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E24B4A',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#E24B4A',
    fontWeight: '700',
  },
  languageRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  languageChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
  },
  languageChipActive: {
    borderColor: '#E24B4A',
    backgroundColor: '#FEE2E2',
  },
  languageChipText: {
    color: '#334155',
    fontWeight: '600',
  },
  languageChipTextActive: {
    color: '#991B1B',
  },
  primaryButton: {
    marginTop: 'auto',
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
