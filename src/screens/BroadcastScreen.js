import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { useAppContext } from '@/context/AppContext';

function buildQrPattern(seedText) {
  const seed = Array.from(seedText).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const size = 21;
  const cells = [];

  for (let row = 0; row < size; row += 1) {
    const nextRow = [];
    for (let col = 0; col < size; col += 1) {
      const base = Math.abs(Math.sin(seed + row * 11 + col * 7)) * 1000;
      nextRow.push(base % 1 > 0.5);
    }
    cells.push(nextRow);
  }

  const paintFinder = (x, y) => {
    for (let row = y; row < y + 7; row += 1) {
      for (let col = x; col < x + 7; col += 1) {
        const edge = row === y || row === y + 6 || col === x || col === x + 6;
        const inner = row >= y + 2 && row <= y + 4 && col >= x + 2 && col <= x + 4;
        cells[row][col] = edge || inner;
      }
    }
  };

  paintFinder(0, 0);
  paintFinder(size - 7, 0);
  paintFinder(0, size - 7);
  return cells;
}

function QrPreview({ value }) {
  const cells = buildQrPattern(value);
  return (
    <View style={styles.qrFrame}>
      {cells.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.qrRow}>
          {row.map((filled, colIndex) => (
            <View key={`cell-${rowIndex}-${colIndex}`} style={[styles.qrCell, filled && styles.qrCellFilled]} />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function BroadcastScreen() {
  const router = useRouter();
  const { profile, contacts, currentLocation, activeIncident, latestTriageReport, latestBroadcastMessage, demoFlowStep, setDemoFlowStep } = useAppContext();
  const sessionId = activeIncident?.sessionId ?? 'live';
  const message = latestBroadcastMessage || activeIncident?.broadcastMessage || [
    '🚨 EMERGENCY ALERT',
    `Person: ${profile.name} | Blood: ${profile.bloodGroup}`,
    `Location: ${currentLocation?.address ?? profile.address}`,
    `Coordinates: ${currentLocation ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}` : 'n/a'}`,
    `Incident: ${latestTriageReport?.emergencyType ?? 'medical'}`,
    `Time: ${new Date().toLocaleString()}`,
    `Track live: roadsos.app/track/${sessionId}`,
    `Medical conditions: ${profile.conditions || 'None'}`,
    `Emergency contact: ${contacts?.[0]?.name ?? 'Unknown'} ${contacts?.[0]?.phone ?? ''}`,
  ].join('\n');

  const medicalProfile = {
    name: profile.name,
    bloodGroup: profile.bloodGroup,
    conditions: profile.conditions,
    address: profile.address,
    location: currentLocation,
    emergencyContact: contacts?.[0] ?? null,
    triage: latestTriageReport ?? null,
    sessionId,
  };

  useEffect(() => {
    if (demoFlowStep !== 'broadcast') return undefined;

    const timer = setTimeout(() => {
      setDemoFlowStep('hospital');
      router.push('/nearby');
    }, 1800);

    return () => clearTimeout(timer);
  }, [demoFlowStep, router, setDemoFlowStep]);

  async function shareWhatsApp() {
    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/?text=${encoded}`;
    await Linking.openURL(url);
  }

  async function shareSms() {
    const phoneList = contacts.map((contact) => contact.phone).join(',');
    const encoded = encodeURIComponent(message);
    await Linking.openURL(`sms:${phoneList}?body=${encoded}`);
  }

  async function copyMessage() {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      return;
    }
    await Share.share({ message });
  }

  async function shareNative() {
    await Share.share({ message });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Broadcast</Text>
      <Text style={styles.subtitle}>One-tap emergency message for family and first responders.</Text>

      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>Live broadcast message</Text>
          <Text style={styles.sessionBadge}>{sessionId}</Text>
        </View>
        <Text style={styles.messageBox}>{message}</Text>
      </View>

      <View style={styles.actionsGrid}>
        <Pressable style={styles.actionButton} onPress={shareWhatsApp}>
          <Text style={styles.actionText}>WhatsApp</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={shareSms}>
          <Text style={styles.actionText}>SMS Contacts</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={copyMessage}>
          <Text style={styles.actionText}>Copy</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={shareNative}>
          <Text style={styles.actionText}>Share Sheet</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Responder QR</Text>
        <Text style={styles.cardSub}>Scannable medical ID snapshot with live location and session info.</Text>
        <QrPreview value={JSON.stringify(medicalProfile)} />
      </View>

      <View style={styles.footerCard}>
        <Text style={styles.footerTitle}>Medical profile preview</Text>
        <Text style={styles.footerLine}>Name: {medicalProfile.name}</Text>
        <Text style={styles.footerLine}>Blood group: {medicalProfile.bloodGroup}</Text>
        <Text style={styles.footerLine}>Emergency contact: {medicalProfile.emergencyContact?.name ?? 'n/a'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07101F', padding: 16, gap: 14 },
  title: { color: '#fff', fontSize: 32, fontWeight: '900' },
  subtitle: { color: '#CBD5E1' },
  card: { backgroundColor: '#0B1326', borderRadius: 22, padding: 16, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  sessionBadge: { color: '#07101F', backgroundColor: '#A7F3D0', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '900' },
  messageBox: { color: '#E5E7EB', lineHeight: 20, fontSize: 13 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionButton: { flexBasis: '48%', flexGrow: 1, backgroundColor: '#152341', paddingVertical: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  actionText: { color: '#fff', fontWeight: '800' },
  cardSub: { color: '#9CA3AF', fontSize: 13, lineHeight: 18 },
  qrFrame: { width: 220, height: 220, alignSelf: 'center', backgroundColor: '#fff', padding: 8, borderRadius: 18, marginTop: 4, overflow: 'hidden' },
  qrRow: { flexDirection: 'row', flex: 1 },
  qrCell: { flex: 1, aspectRatio: 1, margin: 0.5, backgroundColor: '#fff' },
  qrCellFilled: { backgroundColor: '#0F172A' },
  footerCard: { backgroundColor: '#0F172A', borderRadius: 18, padding: 14, gap: 4 },
  footerTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  footerLine: { color: '#CBD5E1', fontSize: 13 },
});
