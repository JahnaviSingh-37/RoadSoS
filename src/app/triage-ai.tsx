import TriageAIScreen from '@/screens/TriageAIScreen';
import { useLocalSearchParams } from 'expo-router';

export default function TriageAIRoute() {
  const params = useLocalSearchParams();
  const lat = Number(params.lat);
  const lng = Number(params.lng);
  const voiceDescription = typeof params.voice === 'string' ? params.voice : undefined;
  const source = typeof params.source === 'string' ? params.source : undefined;
  const initialLocation = Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : undefined;

  return <TriageAIScreen initialLocation={initialLocation} initialDescription={voiceDescription} source={source} />;
}