import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppProvider } from '@/context/AppContext';
import '@/services/nearbyOfflineService';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AppProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="demo" options={{ title: 'Demo Mode' }} />
          <Stack.Screen name="triage-ai" options={{ headerShown: false }} />
          <Stack.Screen name="broadcast" options={{ title: 'Broadcast' }} />
          <Stack.Screen name="incident-report" options={{ title: 'Incident Report' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </AppProvider>
  );
}
