import AsyncStorage from '@react-native-async-storage/async-storage';

const DEMO_MODE_ENABLED_KEY = 'demo_mode_enabled';

export async function isDemoModeEnabled() {
  const raw = await AsyncStorage.getItem(DEMO_MODE_ENABLED_KEY);
  return raw === 'true';
}

export async function setDemoModeEnabled(enabled) {
  await AsyncStorage.setItem(DEMO_MODE_ENABLED_KEY, enabled ? 'true' : 'false');
}

export const demoModeService = {
  isDemoModeEnabled,
  setDemoModeEnabled,
};
