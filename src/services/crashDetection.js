import { Audio } from 'expo-av';
import { Accelerometer } from 'expo-sensors';
import { Alert, Vibration } from 'react-native';

// 4.2G = empirical crash threshold
const THRESHOLDS = { low: 4.2, medium: 3.5, high: 2.8 };
const WINDOW_MS = 200;  // how long over threshold before firing
const COUNTDOWN_SEC = 15;
const DEBOUNCE_MS = 10_000;

let sensitivity = 'medium';
let accel = null;
let exceedStart = null;
let countdown = null;
let sound = null;
let active = false;
let lastCrash = 0;
let handlers = {};

function g() {
  return THRESHOLDS[sensitivity] ?? THRESHOLDS.medium;
}

function emit(state) {
  handlers.onUpdate?.(state);
}

async function playSound() {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound: s } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
      { shouldPlay: true, volume: 1 }
    );
    sound = s;
  } catch (e) {
    handlers.onError?.(e);
  }
}

function dismiss() {
  active = false;
  exceedStart = null;
  if (countdown) clearInterval(countdown);
  Vibration.cancel();
  emit({ visible: false, sec: 0 });
}

function countdown_tick() {
  active = true;
  let sec = COUNTDOWN_SEC;
  emit({ visible: true, sec });
  
  if (!handlers.onUpdate) {
    Alert.alert('Crash!', `SOS in ${COUNTDOWN_SEC}s`, [{ text: 'Cancel', onPress: dismiss }]);
  }

  if (countdown) clearInterval(countdown);
  countdown = setInterval(() => {
    sec--;
    if (sec <= 0) {
      handlers.onSos?.();
      dismiss();
    } else {
      emit({ visible: true, sec });
    }
  }, 1000);
}

export function setSensitivity(level) {
  if (!THRESHOLDS[level]) throw new Error('Bad level: low/medium/high');
  sensitivity = level;
}

export function startMonitoring(h = {}) {
  handlers = h;
  stopMonitoring();
  
  Accelerometer.setUpdateInterval(100);
  accel = Accelerometer.addListener(({ x, y, z }) => {
    const mag = Math.sqrt(x * x + y * y + z * z);
    const now = Date.now();
    
    if (active || now - lastCrash < DEBOUNCE_MS) return;
    if (mag < g()) { exceedStart = null; return; }
    
    if (!exceedStart) { exceedStart = now; return; }
    if (now - exceedStart < WINDOW_MS) return;
    
    lastCrash = now;
    exceedStart = null;
    Vibration.vibrate([0, 500, 200, 500]);
    playSound();
    handlers.onDetected?.({ g: mag, threshold: g() });
    countdown_tick();
  });
}

export function stopMonitoring() {
  accel?.remove();
  accel = null;
  exceedStart = null;
  if (countdown) clearInterval(countdown);
  active = false;
  emit({ visible: false, sec: 0 });
  Vibration.cancel();
  sound?.unloadAsync?.().catch(() => {});
  sound = null;
}

export function triggerDemo(h = {}) {
  handlers = { ...handlers, ...h };
  if (active) return;
  
  const now = Date.now();
  lastCrash = now;
  Vibration.vibrate([0, 500, 200, 500]);
  playSound();
  handlers.onDetected?.({ g: g(), threshold: g(), demo: true });
  countdown_tick();
}

export const crashDetection = { startMonitoring, stopMonitoring, setSensitivity, triggerDemo };
