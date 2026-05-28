import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import EmergencyMantra from '@/components/EmergencyMantra';
import { useAppContext } from '@/context/AppContext';

function severityBand(score) {
  if (score >= 8) return { label: 'CRITICAL', color: '#DC2626' };
  if (score >= 5) return { label: 'SERIOUS', color: '#F59E0B' };
  return { label: 'STABLE', color: '#10B981' };
}

async function analyzeWithClaude({ description, imageSummary, locationText }) {
  const apiKey = await AsyncStorage.getItem('claudeApiKey');

  if (!apiKey) {
    return {
      emergencyType: imageSummary?.emergencyType || 'medical',
      severityScore: imageSummary?.severityScore || 7,
      confidenceScore: imageSummary?.confidenceScore || 87,
      signals: [
        `impact force ${imageSummary?.impactForceG || 4.2}G`,
        `location (${locationText !== 'Location unavailable' ? 'highway' : 'unknown'})`,
        `time (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
      ],
      callPriority: ['ambulance', 'police'],
      firstAidSteps: [
        { title: 'Check responsiveness and breathing', seconds: 60 },
        { title: 'Call emergency services immediately', seconds: 60 },
        { title: 'Keep the person still and monitor until help arrives', seconds: 60 }
      ],
      estimatedResponseTime: '8-12 min',
      recommendedAction: 'Call ambulance and prepare to share location.'
    };
  }

  const systemPrompt = [
    'You are an emergency triage assistant.',
    'Return ONLY JSON with keys: emergencyType, severityScore, confidenceScore, signals, callPriority, firstAidSteps, estimatedResponseTime, recommendedAction.',
    'emergencyType must be one of accident, medical, fire, crime.',
    'callPriority must be an ordered array using ambulance, police, fire.',
    'signals must be a concise array of diagnostic signals.',
    'firstAidSteps must be a concise array of objects with title and seconds.',
    'severityScore must be an integer 1-10.'
  ].join(' ');

  const userPrompt = [
    `Description: ${description || 'n/a'}`,
    imageSummary ? `Image summary: ${JSON.stringify(imageSummary)}` : '',
    locationText ? `Area: ${locationText}` : ''
  ].filter(Boolean).join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 700,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude request failed with ${response.status}`);
  }

  const data = await response.json();
  const text = data?.content?.map((chunk) => chunk?.text || '').join('') || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Claude response did not contain JSON');
  }

  return JSON.parse(match[0]);
}

async function callVisionApi(imageBase64) {
  const visionApiUrl = await AsyncStorage.getItem('visionApiUrl');
  const visionApiKey = await AsyncStorage.getItem('visionApiKey');

  if (!visionApiUrl || !visionApiKey) {
    return {
      emergencyType: 'accident',
      severityScore: 7,
      recommendedAction: 'Approach carefully, call ambulance, and do not move the injured person unless there is immediate danger.'
    };
  }

  const response = await fetch(visionApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${visionApiKey}`
    },
    body: JSON.stringify({ imageBase64, task: 'emergency triage scene analysis' })
  });

  if (!response.ok) {
    throw new Error(`Vision request failed with ${response.status}`);
  }

  return response.json();
}

async function analyzeImageMock() {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return {
    emergencyType: 'accident',
    severityScore: 7,
    confidenceScore: 87,
    impactForceG: 4.2,
    recommendedAction: 'Approach carefully, call ambulance, and do not move the injured person unless there is immediate danger.'
  };
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const seconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function ConfidenceMeter({ value }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value / 100,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [animatedValue, value]);

  const width = animatedValue.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.confidenceCard}>
      <View style={styles.confidenceHeader}>
        <Text style={styles.confidenceLabel}>Confidence</Text>
        <Text style={styles.confidenceValue}>{Math.round(value)}% confident</Text>
      </View>
      <View style={styles.confidenceTrack}>
        <Animated.View style={[styles.confidenceFill, { width }]} />
      </View>
    </View>
  );
}

function PersonalFirstAid({ steps, onDone, onSkip, onSpeak, activeStepIndex, stepRemainingSeconds }) {
  return (
    <View style={styles.personalAidCard}>
      <Text style={styles.personalAidTitle}>You are alone. Here is what YOU can do right now:</Text>
      {steps?.map((step, index) => {
        const active = index === activeStepIndex;
        return (
          <View key={step.title} style={[styles.personalStepCard, active && styles.personalStepCardActive]}>
            <View style={styles.personalStepTopRow}>
              <Text style={styles.personalStepTitle}>{`Step ${index + 1}: ${step.title}`}</Text>
              <Text style={styles.personalStepTimer}>{active ? `00:${String(stepRemainingSeconds).padStart(2, '0')}` : `${step.seconds}s`}</Text>
            </View>
            <View style={styles.personalStepActions}>
              <Pressable style={styles.stepActionButton} onPress={() => onDone(index)}>
                <Text style={styles.stepActionButtonText}>Done</Text>
              </Pressable>
              <Pressable style={[styles.stepActionButton, styles.stepActionSecondary]} onPress={() => onSkip(index)}>
                <Text style={styles.stepActionButtonText}>Skip</Text>
              </Pressable>
              <Pressable style={[styles.stepActionButton, styles.stepActionSpeak]} onPress={() => onSpeak(step.title)}>
                <Text style={styles.stepActionButtonText}>Speak</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function StepTimer({ steps }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!steps?.length) return undefined;
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % steps.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [steps]);

  if (!steps?.length) return null;

  return (
    <View style={styles.timerRow}>
      {steps.map((step, index) => (
        <View key={`${step}-${index}`} style={[styles.timerPill, index === activeIndex && styles.timerPillActive]}>
          <Text style={styles.timerPillText}>{index === activeIndex ? 'Now' : `${Math.max(1, index) * 15}s`}</Text>
        </View>
      ))}
    </View>
  );
}

function SpeechRecorder({ onTranscript, disabled }) {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);

  useEffect(() => () => {
    try {
      recognitionRef.current?.stop?.();
    } catch (e) {
      // ignore
    }
  }, []);

  const startListening = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Voice input unavailable', 'Web Speech API is currently supported in the web build.');
      return;
    }

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SpeechRecognition) {
      Alert.alert('Voice input unavailable', 'This browser does not support the Web Speech API.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      onTranscript(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <Pressable disabled={disabled} onPress={startListening} style={[styles.primaryButton, listening && styles.primaryButtonActive, disabled && styles.disabledButton]}>
      <Text style={styles.primaryButtonText}>{listening ? 'Listening...' : 'Describe What Happened'}</Text>
    </Pressable>
  );
}

export default function TriageAIScreen({ initialLocation, initialDescription, source }) {
  const router = useRouter();
  const { registerTriageReport, setCurrentLocation, setDemoFlowStep, preferences } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [visionResult, setVisionResult] = useState(null);
  const [report, setReport] = useState(null);
  const [location, setLocation] = useState(initialLocation || null);
  const [confidenceValue, setConfidenceValue] = useState(0);
  const [incidentStartedAt, setIncidentStartedAt] = useState(Date.now());
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [stepElapsedSeconds, setStepElapsedSeconds] = useState(0);
  const [countdownSeconds, setCountdownSeconds] = useState(60);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [diagnosticSignals, setDiagnosticSignals] = useState([]);
  const [incidentNote, setIncidentNote] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());
  const confidenceAnim = useRef(new Animated.Value(0)).current;
  const spokenStepRef = useRef(null);

  useEffect(() => {
    if (location) return;

    (async () => {
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation(position.coords);
      } catch (e) {
        // ignore location failures on web or if denied
      }
    })();
  }, [location]);

  useEffect(() => {
    if (initialLocation) {
      setCurrentLocation({
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
        address: 'Lucknow, India',
        label: 'Lucknow, India',
      });
    }
  }, [initialLocation, setCurrentLocation]);

  const locationText = useMemo(() => {
    if (!location) return 'Location unavailable';
    return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
  }, [location]);

  const runTriage = async ({ description, imageSummary }) => {
    setLoading(true);
    try {
      const claudeAnalysis = await Promise.race([
        analyzeWithClaude({ description, imageSummary, locationText }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Triage timed out')), 25000))
      ]);

      const severity = severityBand(claudeAnalysis.severityScore || 5);
      const confidenceScore = claudeAnalysis.confidenceScore ?? imageSummary?.confidenceScore ?? 87;
      const normalizedSteps = Array.isArray(claudeAnalysis.firstAidSteps)
        ? claudeAnalysis.firstAidSteps.map((step) => (typeof step === 'string' ? { title: step, seconds: 60 } : step))
        : [];
      const normalizedSignals = Array.isArray(claudeAnalysis.signals) ? claudeAnalysis.signals : [];
      const mergedReport = {
        ...claudeAnalysis,
        severityLabel: severity.label,
        severityColor: severity.color,
        confidenceScore,
        firstAidSteps: normalizedSteps,
        signals: normalizedSignals,
      };

      setConfidenceValue(confidenceScore);
      setDiagnosticSignals(normalizedSignals.length ? normalizedSignals : [
        `impact force ${imageSummary?.impactForceG || 4.2}G`,
        `location (${location ? 'roadway' : 'unknown'})`,
        `time (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      ]);
      setIncidentStartedAt(Date.now());
      setIncidentNote(`Ambulance avg response time in this area: ${claudeAnalysis.estimatedResponseTime || '8 min'}`);
      setActiveStepIndex(0);
      setStepElapsedSeconds(0);
      setCountdownSeconds(60);
      setCompletedSteps([]);
      setReport(mergedReport);
      registerTriageReport(mergedReport, location);
      void AsyncStorage.setItem('lastIncidentAt', String(Date.now()));

      if (source === 'voice-sos' || source === 'button-sos') {
        setDemoFlowStep(preferences.demoModeEnabled ? 'broadcast' : 'idle');
        router.replace('/broadcast');
      }
    } catch (e) {
      Alert.alert('Triage failed', 'Could not complete the triage analysis. Please call emergency services directly.');
    } finally {
      setLoading(false);
    }
  };

  const attachPhoto = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Photo import unavailable', 'Use the web build to attach a scene photo for triage.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const imageBase64 = String(reader.result || '').split(',')[1] || '';
        const imageSummary = await callVisionApi(imageBase64).catch(async () => analyzeImageMock());
        setVisionResult({ fileName: file.name, ...imageSummary });
        await runTriage({ description: transcript, imageSummary });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const onTranscript = async (text) => {
    setTranscript(text);
    await runTriage({ description: text, imageSummary: visionResult });
  };

  useEffect(() => {
    if (!initialDescription) return;

    const timer = setTimeout(() => {
      void runTriage({ description: initialDescription, imageSummary: null });
    }, 250);

    return () => clearTimeout(timer);
  }, [initialDescription]);

  const shareReport = async () => {
    if (!report) return;

    const summary = [
      'Smart Triage Report',
      `Confidence: ${Math.round(report.confidenceScore ?? confidenceValue)}%`,
      `Severity: ${report.severityLabel} (${report.severityScore}/10)`,
      `Emergency: ${report.emergencyType}`,
      `Call priority: ${report.callPriority?.join(' → ') || 'n/a'}`,
      `Estimated response: ${report.estimatedResponseTime || 'n/a'}`,
      `Signals: ${(diagnosticSignals || []).join(' | ')}`,
      `Location: ${locationText}`,
    ].join('\n');

    await Share.share({ message: summary });
  };

  useEffect(() => {
    Animated.timing(confidenceAnim, {
      toValue: confidenceValue / 100,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [confidenceAnim, confidenceValue]);

  useEffect(() => {
    if (!report?.firstAidSteps?.length) return undefined;

    const step = report.firstAidSteps[activeStepIndex];
    if (!step) return undefined;

    spokenStepRef.current = step.title;
    Speech.stop();
    Speech.speak(`Step ${activeStepIndex + 1}. ${step.title}`, { rate: 0.95, pitch: 1 });

    setStepElapsedSeconds(0);
    setCountdownSeconds(step.seconds || 60);

    const timer = setInterval(() => {
      setStepElapsedSeconds((current) => current + 1);
      setCountdownSeconds((current) => {
        if (current <= 1) {
          setActiveStepIndex((nextIndex) => Math.min(nextIndex + 1, report.firstAidSteps.length - 1));
          return 60;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeStepIndex, report?.firstAidSteps]);

  useEffect(() => {
    (async () => {
      const savedIncidentAt = await AsyncStorage.getItem('lastIncidentAt');
      if (!savedIncidentAt) return;

      const elapsedMs = Date.now() - Number(savedIncidentAt);
      if (elapsedMs <= 1000 * 60 * 60 * 24 * 7) {
        setIncidentNote('You had an incident recently. Are you recovered?');
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  function finishStep(index) {
    setCompletedSteps((current) => Array.from(new Set([...current, index])));
    if (report?.firstAidSteps?.length) {
      setActiveStepIndex((current) => Math.min(current + 1, report.firstAidSteps.length - 1));
    }
  }

  function skipStep(index) {
    finishStep(index);
  }

  function speakStep(text) {
    Speech.stop();
    Speech.speak(text, { rate: 0.92, pitch: 1 });
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Smart Triage</Text>
        <Text style={styles.headerBadge}>30s</Text>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Describe what happened</Text>
        <Text style={styles.heroCopy}>Use voice or a photo. The assistant will classify the emergency and recommend the next action.</Text>
        <EmergencyMantra tone="dark" />
        <SpeechRecorder onTranscript={onTranscript} disabled={loading} />
        <Pressable onPress={attachPhoto} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Attach Photo</Text>
        </Pressable>
      </View>

      <View style={styles.reportCard}>
        <Text style={styles.sectionTitle}>Live Triage Report</Text>
        {loading && <ActivityIndicator color="#fff" />}
        {!loading && !report && <Text style={styles.mutedText}>Waiting for voice or image input.</Text>}

        {report && (
          <View>
            <View style={[styles.severityBadge, { backgroundColor: report.severityColor }]}>
              <Text style={styles.severityText}>{report.severityLabel}</Text>
            </View>

            <View style={styles.confidenceHeaderRow}>
              <ConfidenceMeter value={report.confidenceScore ?? confidenceValue} />
              <View style={styles.confidenceSignalsColumn}>
                <Text style={styles.signalTitle}>Based on:</Text>
                {(diagnosticSignals || []).map((signal) => (
                  <Text key={signal} style={styles.signalText}>• {signal}</Text>
                ))}
              </View>
            </View>

            <View style={styles.urgencyCard}>
              <Text style={styles.urgencyLabel}>{incidentNote || 'Ambulance avg response time in this area: 8 min'}</Text>
              <Text style={styles.urgencyTime}>Time elapsed since incident: {formatDuration(Math.floor((nowTick - incidentStartedAt) / 1000))}</Text>
              <Text style={styles.urgencyTime}>Golden hour remaining: {formatDuration(Math.max(0, 3600 - Math.floor((nowTick - incidentStartedAt) / 1000)))}</Text>
            </View>

            <Text style={styles.reportLine}>Emergency type: {report.emergencyType}</Text>
            <Text style={styles.reportLine}>Who to call first: {report.callPriority?.[0] || 'ambulance'}</Text>
            <Text style={styles.reportLine}>Estimated response time: {report.estimatedResponseTime || 'n/a'}</Text>
            <Text style={styles.reportLine}>Recommended action: {report.recommendedAction || 'Call emergency services.'}</Text>

            <Text style={styles.subheading}>Personalized first aid</Text>
            <PersonalFirstAid
              steps={report.firstAidSteps}
              activeStepIndex={activeStepIndex}
              stepRemainingSeconds={countdownSeconds}
              onDone={finishStep}
              onSkip={skipStep}
              onSpeak={speakStep}
            />

            <Pressable onPress={shareReport} style={styles.shareButton}>
              <Text style={styles.shareButtonText}>Share report + location</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Analyze scene, speech, and call priority in under 30 seconds.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07101F', padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '900' },
  headerBadge: { color: '#07101F', backgroundColor: '#A7F3D0', fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  heroCard: { marginTop: 14, backgroundColor: '#0E1A33', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  heroLabel: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroCopy: { color: '#D1D5DB', marginTop: 8, lineHeight: 20 },
  primaryButton: { marginTop: 14, backgroundColor: '#E24B4A', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryButtonActive: { backgroundColor: '#B91C1C' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryButton: { marginTop: 10, backgroundColor: '#152341', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  secondaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  reportCard: { marginTop: 16, backgroundColor: '#0B1326', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', flex: 1 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  mutedText: { color: '#9CA3AF' },
  severityBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  severityText: { color: '#fff', fontWeight: '900', letterSpacing: 0.8 },
  reportLine: { color: '#E5E7EB', marginBottom: 8, lineHeight: 20 },
  subheading: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 10, marginBottom: 8 },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  stepIndex: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#223259', color: '#fff', textAlign: 'center', textAlignVertical: 'center', fontWeight: '800' },
  stepText: { flex: 1, color: '#E5E7EB', lineHeight: 20 },
  shareButton: { marginTop: 10, backgroundColor: '#1D4ED8', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  shareButtonText: { color: '#fff', fontWeight: '800' },
  footerRow: { paddingVertical: 12 },
  footerText: { color: '#9CA3AF' },
  timerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  timerPill: { backgroundColor: '#111B34', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  timerPillActive: { backgroundColor: '#1F3B75' },
  timerPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  confidenceHeaderRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch', marginBottom: 12 },
  circularMeterOuter: { width: 124, height: 124 },
  circularMeterRing: { flex: 1, borderWidth: 10, borderRadius: 62, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B1326' },
  circularMeterText: { fontSize: 24, fontWeight: '900' },
  circularMeterCaption: { fontSize: 11, color: '#CBD5E1', fontWeight: '700' },
  confidenceSignalsColumn: { flex: 1, justifyContent: 'center' },
  confidenceCard: { marginBottom: 8, backgroundColor: '#111B34', borderRadius: 14, padding: 10, gap: 8 },
  confidenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confidenceLabel: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  confidenceValue: { color: '#fff', fontSize: 12, fontWeight: '900' },
  confidenceTrack: { height: 8, backgroundColor: '#223259', borderRadius: 999, overflow: 'hidden' },
  confidenceFill: { height: '100%', borderRadius: 999, backgroundColor: '#60A5FA' },
  signalTitle: { color: '#fff', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  signalText: { color: '#CBD5E1', fontSize: 12, lineHeight: 17 },
  urgencyCard: { backgroundColor: '#0B1326', borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#1E3A8A' },
  urgencyLabel: { color: '#fff', fontWeight: '800', fontSize: 13, marginBottom: 6 },
  urgencyTime: { color: '#E5E7EB', fontSize: 12, lineHeight: 18 },
  personalAidCard: { backgroundColor: '#0B1326', borderRadius: 16, padding: 12, gap: 10, marginTop: 8 },
  personalAidTitle: { color: '#fff', fontSize: 15, fontWeight: '900', lineHeight: 20 },
  personalStepCard: { backgroundColor: '#111B34', borderRadius: 14, padding: 10, gap: 10 },
  personalStepCardActive: { borderWidth: 1, borderColor: '#60A5FA' },
  personalStepTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  personalStepTitle: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '800' },
  personalStepTimer: { color: '#A7F3D0', fontWeight: '900' },
  personalStepActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepActionButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1D4ED8' },
  stepActionSecondary: { backgroundColor: '#334155' },
  stepActionSpeak: { backgroundColor: '#7C3AED' },
  stepActionButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});