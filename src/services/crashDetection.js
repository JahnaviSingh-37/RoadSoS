import { Audio } from 'expo-av';
import { Accelerometer } from 'expo-sensors';
import { Alert, Vibration } from 'react-native';

const SAMPLE_INTERVAL_MS = 100;
const CRASH_PERSISTENCE_MS = 200;
const AUTO_SOS_COUNTDOWN_SECONDS = 15;
const CRASH_COOLDOWN_MS = 10_000;

const SENSITIVITY_THRESHOLDS = {
  low: 4.2,
  medium: 3.5,
  high: 2.8,
};

let activeSensitivity = 'medium';
let accelerometerSubscription = null;
let exceedStartTimestamp = null;
let countdownInterval = null;
let alertSound = null;
let crashPromptActive = false;
let lastCrashTimestamp = 0;

let runtimeHandlers = {
  onCrashPromptUpdate: null,
  onAutoSOS: null,
  onCrashDetected: null,
  onError: null,
};

function getThreshold() {
  return SENSITIVITY_THRESHOLDS[activeSensitivity] ?? SENSITIVITY_THRESHOLDS.medium;
}

function emitPromptState(state) {
  runtimeHandlers.onCrashPromptUpdate?.(state);
}

function clearCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

async function unloadAlertSound() {
  if (!alertSound) {
    return;
  }

  try {
    await alertSound.unloadAsync();
  } catch {
    // Ignore unload errors because sound disposal should not crash monitoring.
  }

  alertSound = null;
}

async function playAlertSound() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    const result = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
      { shouldPlay: true, volume: 1.0 }
    );

    alertSound = result.sound;
  } catch (error) {
    runtimeHandlers.onError?.(error);
  }
}

function dismissCrashPrompt() {
  crashPromptActive = false;
  clearCountdown();
  exceedStartTimestamp = null;
  Vibration.cancel();

  emitPromptState({
    visible: false,
    secondsLeft: 0,
    dismiss: dismissCrashPrompt,
  });
}

function runAutoSosTrigger() {
  dismissCrashPrompt();
  runtimeHandlers.onAutoSOS?.();
}

function startCrashPrompt() {
  crashPromptActive = true;
  let secondsLeft = AUTO_SOS_COUNTDOWN_SECONDS;

  emitPromptState({
    visible: true,
    secondsLeft,
    dismiss: dismissCrashPrompt,
  });

  if (!runtimeHandlers.onCrashPromptUpdate) {
    Alert.alert(
      'Crash detected',
      `Possible crash detected. SOS will trigger in ${AUTO_SOS_COUNTDOWN_SECONDS} seconds.`,
      [{ text: 'Dismiss', style: 'cancel', onPress: dismissCrashPrompt }]
    );
  }

  clearCountdown();
  countdownInterval = setInterval(() => {
    secondsLeft -= 1;

    if (secondsLeft <= 0) {
      runAutoSosTrigger();
      return;
    }

    emitPromptState({
      visible: true,
      secondsLeft,
      dismiss: dismissCrashPrompt,
    });
  }, 1000);
}

export function triggerDemoCrash(handlers = {}) {
  runtimeHandlers = {
    ...runtimeHandlers,
    ...handlers,
  };

  if (crashPromptActive) {
    return;
  }

  const now = Date.now();
  lastCrashTimestamp = now;
  exceedStartTimestamp = null;

  Vibration.vibrate([0, 500, 200, 500]);
  void playAlertSound();

  runtimeHandlers.onCrashDetected?.({
    magnitude: getThreshold(),
    threshold: getThreshold(),
    sensitivity: activeSensitivity,
    timestamp: now,
    simulated: true,
  });

  startCrashPrompt();
}

function handlePotentialCrash(gForceMagnitude) {
  const now = Date.now();
  if (crashPromptActive || now - lastCrashTimestamp < CRASH_COOLDOWN_MS) {
    return;
  }

  const threshold = getThreshold();
  if (gForceMagnitude < threshold) {
    exceedStartTimestamp = null;
    return;
  }

  if (!exceedStartTimestamp) {
    exceedStartTimestamp = now;
    return;
  }

  if (now - exceedStartTimestamp < CRASH_PERSISTENCE_MS) {
    return;
  }

  lastCrashTimestamp = now;
  exceedStartTimestamp = null;

  Vibration.vibrate([0, 500, 200, 500]);
  void playAlertSound();

  runtimeHandlers.onCrashDetected?.({
    magnitude: gForceMagnitude,
    threshold,
    sensitivity: activeSensitivity,
    timestamp: now,
  });

  startCrashPrompt();
}

export function setSensitivity(level) {
  if (!Object.prototype.hasOwnProperty.call(SENSITIVITY_THRESHOLDS, level)) {
    throw new Error('Invalid sensitivity level. Use low, medium, or high.');
  }

  activeSensitivity = level;
}

export function startMonitoring(handlers = {}) {
  runtimeHandlers = {
    ...runtimeHandlers,
    ...handlers,
  };

  stopMonitoring();

  Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
  accelerometerSubscription = Accelerometer.addListener(({ x, y, z }) => {
    const gForceMagnitude = Math.sqrt(x * x + y * y + z * z);
    handlePotentialCrash(gForceMagnitude);
  });
}

export function stopMonitoring() {
  accelerometerSubscription?.remove();
  accelerometerSubscription = null;
  exceedStartTimestamp = null;

  clearCountdown();
  crashPromptActive = false;
  emitPromptState({
    visible: false,
    secondsLeft: 0,
    dismiss: dismissCrashPrompt,
  });

  Vibration.cancel();
  void unloadAlertSound();
}

export const crashDetection = {
  startMonitoring,
  stopMonitoring,
  setSensitivity,
  triggerDemoCrash,
};
