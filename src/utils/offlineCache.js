import AsyncStorage from '@react-native-async-storage/async-storage';

export const offlineCache = {
  async set(key, value) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  async get(key) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async remove(key) {
    await AsyncStorage.removeItem(key);
  },
};
