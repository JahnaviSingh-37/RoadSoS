import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { useAppContext } from '@/context/AppContext';
import { triggerDemoCrash } from '@/services/crashDetection';
import { isDemoModeEnabled, setDemoModeEnabled } from '@/services/demoModeService';

const TOUR_STEPS = [
  {
    title: 'Crash Detection Demo',
    body: 'Simulate a crash event instantly to show automatic emergency readiness.',
  },
  {
    title: 'Live Tracking Demo',
    body: 'Showcase shareable live tracking sessions for responders and family.',
  },
  {
    title: 'Offline Mode Demo',
    body: 'Nearby services still appear from saved cache when network is unavailable.',
  },
  {
    title: 'Triage Demo',
    body: 'Use first-aid triage to classify severity and recommend first response.',
  },
  {
    title: 'Multi-language Demo',
    body: 'Switch language preferences for localized support experience.',
  },
];

const CHECKLIST_ITEMS = [
  'Crash Detection',
  'Live Tracking',
  'Offline Mode',
  'Triage',
  'Multi-language',
];

export default function DemoModeScreen() {
  const router = useRouter();
  const { setDemoFlowStep, setDemoModeEnabled: setSharedDemoModeEnabled } = useAppContext();
  const [demoModeEnabled, setDemoModeEnabledState] = useState(false);
  const [tourVisible, setTourVisible] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadMode() {
      const enabled = await isDemoModeEnabled();
      if (mounted) {
        setDemoModeEnabledState(enabled);
      }
    }

    loadMode();

    return () => {
      mounted = false;
    };
  }, []);

  async function toggleDemoMode() {
    const nextValue = !demoModeEnabled;
    await setDemoModeEnabled(nextValue);
    setSharedDemoModeEnabled(nextValue);
    setDemoModeEnabledState(nextValue);
  }

  async function runFullDemo() {
    await setDemoModeEnabled(true);
    setSharedDemoModeEnabled(true);
    setDemoModeEnabledState(true);
    setDemoFlowStep('drive');
    router.replace('/drive');
  }

  function startTour() {
    setTourIndex(0);
    setTourVisible(true);
  }

  function nextTourStep() {
    if (tourIndex >= TOUR_STEPS.length - 1) {
      setTourVisible(false);
      return;
    }

    setTourIndex((prev) => prev + 1);
  }

  function simulateCrash() {
    triggerDemoCrash();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Demo Mode</Text>
        <Text style={styles.subtitle}>Curated flow for judges and presentations</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Safe SOS calls</Text>
          <Text style={styles.cardBody}>
            Prevents real emergency dialing and shows a mock connecting screen instead.
          </Text>

          <Pressable style={styles.toggleButton} onPress={toggleDemoMode}>
            <Text style={styles.toggleButtonText}>
              {demoModeEnabled ? 'Disable Demo Call Mode' : 'Enable Demo Call Mode'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.rowButtons}>
          <Pressable style={styles.actionButton} onPress={simulateCrash}>
            <Text style={styles.actionButtonText}>Simulate Crash Trigger</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={startTour}>
            <Text style={styles.actionButtonText}>Start Guided Tour</Text>
          </Pressable>
        </View>

        <Pressable style={styles.demoLaunchButton} onPress={runFullDemo}>
          <Text style={styles.demoLaunchButtonText}>Run Full Product Demo</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Feature Checklist</Text>
          {CHECKLIST_ITEMS.map((item) => (
            <Text key={item} style={styles.checkItem}>
              {item} ✓
            </Text>
          ))}
        </View>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to Settings</Text>
        </Pressable>
      </ScrollView>

      <Modal transparent visible={tourVisible} animationType="fade">
        <View style={styles.tourBackdrop}>
          <View style={styles.tourCard}>
            <Text style={styles.tourStepCount}>Step {tourIndex + 1} / {TOUR_STEPS.length}</Text>
            <Text style={styles.tourTitle}>{TOUR_STEPS[tourIndex].title}</Text>
            <Text style={styles.tourBody}>{TOUR_STEPS[tourIndex].body}</Text>

            <View style={styles.tourActions}>
              <Pressable style={styles.tourSecondary} onPress={() => setTourVisible(false)}>
                <Text style={styles.tourSecondaryText}>Close</Text>
              </Pressable>

              <Pressable style={styles.tourPrimary} onPress={nextTourStep}>
                <Text style={styles.tourPrimaryText}>
                  {tourIndex >= TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF7F7',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 26,
    gap: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    color: '#475569',
    fontSize: 14,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3D2D2',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  cardBody: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  toggleButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: '#E24B4A',
    paddingVertical: 11,
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  rowButtons: {
    gap: 10,
  },
  actionButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingVertical: 11,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#1E293B',
    fontWeight: '700',
  },
  demoLaunchButton: {
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E24B4A',
  },
  demoLaunchButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  checkItem: {
    color: '#14532D',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  backButton: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  backButtonText: {
    color: '#1E293B',
    fontWeight: '700',
  },
  tourBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.56)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  tourCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 10,
  },
  tourStepCount: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  tourTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
  },
  tourBody: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 21,
  },
  tourActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 10,
  },
  tourSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tourSecondaryText: {
    color: '#334155',
    fontWeight: '700',
  },
  tourPrimary: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#E24B4A',
    paddingVertical: 10,
    alignItems: 'center',
  },
  tourPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
