import { useRef } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { useAppContext } from '@/context/AppContext';

function ReportRow({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default function IncidentReportScreen() {
  const { latestIncidentReport, activeIncident, completeIncidentSession, incidentHistory, profile, currentLocation } = useAppContext();
  const reportRef = useRef(null);
  const report = latestIncidentReport || {
    reportId: 'INC-2024-001',
    dateTime: new Date().toLocaleString(),
    duration: '00:08:42',
    trigger: activeIncident?.trigger ?? 'Crash Detected',
    severity: activeIncident?.triage?.severityLabel ?? 'CRITICAL',
    aiConfidence: `${Math.round(activeIncident?.triage?.confidenceScore ?? 89)}%`,
    locationName: currentLocation?.address ?? profile.address,
    coordinates: currentLocation ? `${currentLocation.latitude.toFixed(4)}°N, ${currentLocation.longitude.toFixed(4)}°E` : 'n/a',
    ambulanceCalled: '108',
    responseTime: activeIncident?.triage?.estimatedResponseTime ?? '7 min',
    hospital: activeIncident?.triage?.bestHospital?.name ?? 'KGMU Lucknow',
    witnessesAlerted: 4,
    firstAidSteps: activeIncident?.triage?.firstAidSteps ?? [
      { title: 'Checked consciousness' },
      { title: 'Recovery position' },
      { title: 'Controlled bleeding' },
    ],
  };

  function buildShareSummary() {
    const summary = [
      `ROADSOS INCIDENT REPORT ${report.reportId}`,
      `Date/Time: ${report.dateTime}`,
      `Duration: ${report.duration}`,
      `Trigger: ${report.trigger}`,
      `Severity: ${report.severity}`,
      `AI Confidence: ${report.aiConfidence}`,
      `Location: ${report.locationName}`,
      `Coordinates: ${report.coordinates}`,
      `Response time: ${report.responseTime}`,
      `Hospital: ${report.hospital}`,
    ].join('\n');

    return summary;
  }

  function buildSvgMarkup() {
    const lines = [
      ['ROADSOS INCIDENT REPORT', 58, 90, 32, 'bold'],
      [`Report #: ${report.reportId}`, 58, 138, 20, 'bold'],
      [`Date/Time: ${report.dateTime}`, 58, 220, 18],
      [`Duration: ${report.duration}`, 58, 252, 18],
      [`Trigger: ${report.trigger}`, 58, 284, 18],
      [`Severity: ${report.severity}`, 58, 316, 18],
      [`AI Confidence: ${report.aiConfidence}`, 58, 348, 18],
      ['Location', 58, 430, 22, 'bold'],
      [report.locationName, 58, 468, 18],
      [report.coordinates, 58, 500, 18],
      ['Response', 58, 580, 22, 'bold'],
      [`Ambulance called: ${report.ambulanceCalled}`, 58, 618, 18],
      [`Response time: ${report.responseTime}`, 58, 650, 18],
      [`Hospital: ${report.hospital}`, 58, 682, 18],
      [`Witnesses alerted: ${report.witnessesAlerted}`, 58, 714, 18],
    ];

    const steps = (report.firstAidSteps || []).map((step, index) => `✓ ${index + 1}. ${step.title}`);

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
        <rect width="1200" height="1600" fill="#08111F"/>
        <rect x="44" y="44" width="1112" height="1512" rx="34" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
        <rect x="58" y="58" width="1084" height="146" rx="24" fill="#0F172A"/>
        ${lines.map(([text, x, y, size, weight]) => `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight || 'normal'}" fill="${size >= 28 ? '#FFFFFF' : '#0F172A'}">${escapeXml(text)}</text>`).join('')}
        <text x="58" y="798" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="#0F172A">First Aid Administered</text>
        ${steps.map((step, index) => `<text x="58" y="${840 + index * 32}" font-family="Inter, Arial, sans-serif" font-size="18" fill="#334155">${escapeXml(step)}</text>`).join('')}
      </svg>
    `;
  }

  async function shareReport() {
    const summary = buildShareSummary();

    try {
      if (Platform.OS === 'web') {
        const svgMarkup = buildSvgMarkup();
        const svgUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
        await Share.share({ url: svgUri, message: summary });
        return;
      }

      if (Platform.OS !== 'web' && reportRef.current) {
        const imageUri = await captureRef(reportRef.current, {
          format: 'png',
          quality: 1,
        });

        await Share.share({ url: imageUri, message: summary });
        return;
      }
    } catch {
      // fall through to text share
    }

    await Share.share({ message: summary });
  }

  function resolveIncident() {
    completeIncidentSession({
      summary: 'Incident resolved and report generated.',
      hospital: report.hospital,
      responseTime: report.responseTime,
      witnessesAlerted: report.witnessesAlerted,
      ambulanceCalled: report.ambulanceCalled,
      firstAidSteps: report.firstAidSteps,
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Incident Report</Text>
      <Text style={styles.subtitle}>PDF-style summary generated from the last SOS session.</Text>

      <View ref={reportRef} style={styles.reportCard}>
        <Text style={styles.reportHeader}>ROADSOS INCIDENT REPORT</Text>
        <Text style={styles.reportNumber}>Report #: {report.reportId}</Text>

        <View style={styles.section}>
          <ReportRow label="Date/Time" value={report.dateTime} />
          <ReportRow label="Duration" value={report.duration} />
          <ReportRow label="Trigger" value={report.trigger} />
          <ReportRow label="Severity" value={report.severity} />
          <ReportRow label="AI Confidence" value={report.aiConfidence} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <Text style={styles.body}>{report.locationName}</Text>
          <Text style={styles.body}>{report.coordinates}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Response</Text>
          <Text style={styles.body}>Ambulance called: {report.ambulanceCalled}</Text>
          <Text style={styles.body}>Response time: {report.responseTime}</Text>
          <Text style={styles.body}>Hospital: {report.hospital}</Text>
          <Text style={styles.body}>Witnesses alerted: {report.witnessesAlerted}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>First Aid Administered</Text>
          {(report.firstAidSteps || []).map((step) => (
            <Text key={step.title} style={styles.body}>✓ {step.title}</Text>
          ))}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Text style={styles.historyText}>Stored incidents: {incidentHistory.length}/10</Text>
        <Pressable style={styles.actionButton} onPress={shareReport}>
          <Text style={styles.actionText}>Share Snapshot</Text>
        </Pressable>
        <Pressable style={styles.actionButtonSecondary} onPress={resolveIncident}>
          <Text style={styles.actionText}>Mark Resolved</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08111F', padding: 16, gap: 14 },
  title: { color: '#fff', fontSize: 32, fontWeight: '900' },
  subtitle: { color: '#CBD5E1' },
  reportCard: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 16, gap: 12, borderWidth: 1, borderColor: '#CBD5E1' },
  reportHeader: { color: '#0F172A', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  reportNumber: { color: '#475569', textAlign: 'center', fontWeight: '700' },
  section: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, gap: 6 },
  sectionTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  body: { color: '#334155', fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  rowLabel: { color: '#64748B', fontWeight: '700', flex: 1 },
  rowValue: { color: '#0F172A', fontWeight: '800', flex: 1, textAlign: 'right' },
  actionsRow: { gap: 10 },
  historyText: { color: '#CBD5E1' },
  actionButton: { backgroundColor: '#E24B4A', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  actionButtonSecondary: { backgroundColor: '#0F172A', paddingVertical: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  actionText: { color: '#fff', fontWeight: '900' },
});
