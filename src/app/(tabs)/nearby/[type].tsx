import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NearbyDetailScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const title = (type ?? 'service').replace(/(^\w|[-_\s]\w)/g, (part) =>
    part.replace(/[-_\s]/g, '').toUpperCase()
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title }} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>Detail screen for nearby {title.toLowerCase()} support.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
  },
});
