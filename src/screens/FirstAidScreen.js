import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Easing,
    Linking,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { getEmergencyNumbers } from '@/utils/getEmergencyNumbers';

const TRIAGE_STEPS = [
  {
    key: 'conscious',
    question: 'Is the person conscious?',
  },
  {
    key: 'breathing',
    question: 'Are they breathing normally?',
  },
  {
    key: 'bleeding',
    question: 'Is there severe bleeding?',
  },
];

const ANSWER_OPTIONS = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
  { label: 'Unsure', value: 'unsure' },
];

const SERVICE_LABELS = {
  ambulance: 'Ambulance',
  police: 'Police',
  fire: 'Fire Services',
};

const SCENARIO_LIBRARY = {
  cpr_needed: {
    id: 'cpr_needed',
    name: 'CPR needed',
    severity: 'Critical',
    severityColor: '#B91C1C',
    service: 'ambulance',
    instructions: [
      'Call emergency services immediately and put phone on speaker.',
      'Lay the person flat on a firm surface and begin chest compressions.',
      'Push hard and fast in the center of the chest at 100-120 compressions per minute.',
      'If trained, give rescue breaths after every 30 compressions.',
      'Continue CPR until responders arrive or the person starts breathing.',
    ],
  },
  unconscious: {
    id: 'unconscious',
    name: 'Unconscious person',
    severity: 'Critical',
    severityColor: '#B91C1C',
    service: 'ambulance',
    instructions: [
      'Call emergency services right away.',
      'Check airway and place the person in recovery position if breathing normally.',
      'Monitor breathing continuously and be ready to start CPR if breathing stops.',
      'Do not give food or water.',
      'Keep the person warm and still until help arrives.',
    ],
  },
  severe_bleeding: {
    id: 'severe_bleeding',
    name: 'Severe bleeding',
    severity: 'Serious',
    severityColor: '#EA580C',
    service: 'ambulance',
    instructions: [
      'Call emergency services now.',
      'Apply firm, direct pressure on the wound with a clean cloth or bandage.',
      'If blood soaks through, add more cloth on top and keep pressing.',
      'Raise the injured limb above heart level if possible.',
      'If bleeding is life-threatening and trained, apply a tourniquet above the wound.',
    ],
  },
  hazard_fire: {
    id: 'hazard_fire',
    name: 'Possible hazard scene',
    severity: 'Serious',
    severityColor: '#EA580C',
    service: 'fire',
    instructions: [
      'Move people away from immediate danger if safe to do so.',
      'Call fire services first for scene safety and rescue support.',
      'Do not enter smoke-filled or unstable areas.',
      'If trained, provide first aid only when the area is safe.',
      'Guide responders to the exact location when they arrive.',
    ],
  },
  minor_injury: {
    id: 'minor_injury',
    name: 'Minor injury',
    severity: 'Stable',
    severityColor: '#15803D',
    service: 'police',
    instructions: [
      'Clean minor cuts with clean water and apply a sterile dressing.',
      'Use a cold pack for swelling or bruising for 10-15 minutes.',
      'Observe for any worsening symptoms such as dizziness or increasing pain.',
      'If incident-related assistance is needed, contact police for support.',
      'Seek clinic care if symptoms persist or worsen.',
    ],
  },
};

function deriveScenario(answers) {
  const conscious = answers.conscious;
  const breathing = answers.breathing;
  const bleeding = answers.bleeding;

  if (conscious === 'no' && breathing === 'no') {
    return SCENARIO_LIBRARY.cpr_needed;
  }

  if (conscious === 'no') {
    return SCENARIO_LIBRARY.unconscious;
  }

  if (bleeding === 'yes') {
    return SCENARIO_LIBRARY.severe_bleeding;
  }

  if (breathing === 'unsure' || bleeding === 'unsure') {
    return SCENARIO_LIBRARY.hazard_fire;
  }

  return SCENARIO_LIBRARY.minor_injury;
}

export default function FirstAidScreen() {
  const [answers, setAnswers] = useState({
    conscious: null,
    breathing: null,
    bleeding: null,
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [countryCode, setCountryCode] = useState(null);

  const progressAnim = useRef(new Animated.Value(1 / TRIAGE_STEPS.length)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepShift = useRef(new Animated.Value(0)).current;

  const isReviewStage = stepIndex >= TRIAGE_STEPS.length;
  const activeStep = TRIAGE_STEPS[Math.min(stepIndex, TRIAGE_STEPS.length - 1)];

  const scenario = useMemo(() => {
    if (!isReviewStage) {
      return null;
    }

    return deriveScenario(answers);
  }, [answers, isReviewStage]);

  useEffect(() => {
    let mounted = true;

    async function resolveCountry() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const geocode = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        const isoCode = geocode[0]?.isoCountryCode;
        if (mounted && isoCode) {
          setCountryCode(isoCode.toUpperCase());
        }
      } catch {
        // Keep default emergency mapping on location failures.
      }
    }

    resolveCountry();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const progressRatio = Math.min((stepIndex + 1) / TRIAGE_STEPS.length, 1);

    Animated.timing(progressAnim, {
      toValue: progressRatio,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    stepOpacity.setValue(0);
    stepShift.setValue(10);

    Animated.parallel([
      Animated.timing(stepOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(stepShift, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [progressAnim, stepIndex, stepOpacity, stepShift]);

  function handleAnswer(value) {
    if (isReviewStage || !activeStep) {
      return;
    }

    const nextAnswers = {
      ...answers,
      [activeStep.key]: value,
    };

    setAnswers(nextAnswers);
    setStepIndex((prev) => prev + 1);
  }

  function restartFlow() {
    setAnswers({
      conscious: null,
      breathing: null,
      bleeding: null,
    });
    setStepIndex(0);
  }

  async function callRecommendedService() {
    if (!scenario) {
      return;
    }

    const numbers = getEmergencyNumbers(countryCode);
    const targetNumber = numbers[scenario.service] ?? numbers.unified;

    if (!targetNumber) {
      Alert.alert('Call unavailable', 'No emergency number found for this region.');
      return;
    }

    const dialUrl = `tel:${targetNumber}`;

    try {
      const canCall = await Linking.canOpenURL(dialUrl);
      if (!canCall) {
        Alert.alert('Call unavailable', 'This device cannot place calls.');
        return;
      }

      await Linking.openURL(dialUrl);
    } catch {
      Alert.alert('Call failed', `Unable to call ${targetNumber}.`);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.headerTitle}>First Aid Triage</Text>
        <Text style={styles.headerSubTitle}>3-step emergency assessment</Text>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <Animated.View
          style={[
            styles.stepCard,
            {
              opacity: stepOpacity,
              transform: [{ translateY: stepShift }],
            },
          ]}>
          {!isReviewStage ? (
            <>
              <Text style={styles.stepLabel}>Step {stepIndex + 1} of {TRIAGE_STEPS.length}</Text>
              <Text style={styles.questionText}>{activeStep.question}</Text>

              <View style={styles.answerList}>
                {ANSWER_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={styles.answerButton}
                    onPress={() => handleAnswer(option.value)}>
                    <Text style={styles.answerButtonText}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.resultHeading}>Assessment Complete</Text>

              <View style={[styles.severityBadge, { backgroundColor: scenario.severityColor }]}> 
                <Text style={styles.severityText}>{scenario.severity}</Text>
              </View>

              <Text style={styles.scenarioTitle}>{scenario.name}</Text>
              <Text style={styles.recommendationText}>
                Call first: {SERVICE_LABELS[scenario.service]}
              </Text>

              <View style={styles.instructionsBlock}>
                {scenario.instructions.map((instruction, index) => (
                  <Text key={instruction} style={styles.instructionText}>
                    {index + 1}. {instruction}
                  </Text>
                ))}
              </View>

              <Pressable style={styles.callButton} onPress={callRecommendedService}>
                <Text style={styles.callButtonText}>Call Now</Text>
              </Pressable>

              <Pressable style={styles.restartButton} onPress={restartFlow}>
                <Text style={styles.restartButtonText}>Start Over</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubTitle: {
    marginTop: 4,
    color: '#475569',
    fontSize: 14,
  },
  progressTrack: {
    marginTop: 16,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E24B4A',
  },
  stepCard: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flex: 1,
  },
  stepLabel: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 8,
  },
  questionText: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
  },
  answerList: {
    marginTop: 22,
    gap: 12,
  },
  answerButton: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
  },
  answerButtonText: {
    color: '#1E3A8A',
    fontSize: 16,
    fontWeight: '700',
  },
  resultHeading: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 10,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  severityText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  scenarioTitle: {
    fontSize: 24,
    color: '#0F172A',
    fontWeight: '800',
  },
  recommendationText: {
    marginTop: 6,
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsBlock: {
    marginTop: 14,
    gap: 8,
  },
  instructionText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  callButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#E24B4A',
    alignItems: 'center',
  },
  callButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  restartButton: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  restartButtonText: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 14,
  },
});
