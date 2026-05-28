import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { isOnboardingCompleted } from '@/services/onboardingService';

export default function OnboardingLayout() {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkOnboarding() {
      const done = await isOnboardingCompleted();
      if (!mounted) {
        return;
      }

      setCompleted(done);
      setLoading(false);
    }

    checkOnboarding();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#E24B4A" />
      </View>
    );
  }

  if (completed) {
    return <Redirect href="/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="intro" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="preferences" />
    </Stack>
  );
}
