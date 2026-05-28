import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_STATE_KEY = 'roadsos_app_state_v1';

export async function loadAppState() {
  const raw = await AsyncStorage.getItem(APP_STATE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveAppState(state) {
  await AsyncStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
}

export const dataSyncService = {
  loadAppState,
  saveAppState,
};
