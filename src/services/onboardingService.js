import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_COMPLETED_KEY = 'onboarding_completed_v1';
export const LANGUAGE_PREFERENCE_KEY = 'preferred_language';

export async function isOnboardingCompleted() {
  const raw = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
  return raw === 'true';
}

export async function completeOnboarding({ language }) {
  await AsyncStorage.multiSet([
    [ONBOARDING_COMPLETED_KEY, 'true'],
    [LANGUAGE_PREFERENCE_KEY, language],
  ]);
}

export async function getPreferredLanguage() {
  const language = await AsyncStorage.getItem(LANGUAGE_PREFERENCE_KEY);
  return language ?? 'English';
}
