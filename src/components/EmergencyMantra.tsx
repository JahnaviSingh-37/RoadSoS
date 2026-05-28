import { StyleSheet, Text, View } from 'react-native';

export default function EmergencyMantra({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <View style={[styles.container, tone === 'light' ? styles.light : styles.dark]}>
      <Text style={[styles.text, tone === 'light' ? styles.textDark : styles.textLight]}>
        In an emergency, every second counts
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  dark: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
  },
  light: {
    backgroundColor: '#FFF7F7',
    borderColor: '#F5D0D0',
  },
  text: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  textLight: {
    color: '#FDE68A',
  },
  textDark: {
    color: '#B91C1C',
  },
});
