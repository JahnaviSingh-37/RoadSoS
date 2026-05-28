import { Stack } from 'expo-router';

export default function NearbyStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Nearby' }} />
      <Stack.Screen name="[type]" options={{ title: 'Nearby Details' }} />
    </Stack>
  );
}
