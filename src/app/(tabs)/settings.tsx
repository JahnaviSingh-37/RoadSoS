import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { useAppContext } from '@/context/AppContext';

export default function SettingsScreen() {
  const { profile, setProfile, contacts, setContacts, preferences, setAutoShareMedicalId, setVoiceSosEnabled, incidentHistory } = useAppContext();

  function updateContact(index, field, value) {
    setContacts((current) => current.map((contact, contactIndex) => (contactIndex === index ? { ...contact, [field]: value } : contact)));
  }

  function addContact() {
    if (contacts.length >= 3) {
      Alert.alert('Contact limit reached', 'You can save up to 3 emergency contacts.');
      return;
    }

    setContacts((current) => [
      ...current,
      { name: 'Neha Sharma', relation: 'Friend', phone: '+91 99887 77665' },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Settings</Text>
        <Text style={styles.subheader}>Your profile, contacts, and Medical ID for faster emergency response.</Text>

        <View style={styles.profileCard}>
          <View style={styles.profileHeaderRow}>
            <Text style={styles.cardTitle}>Medical ID</Text>
            <View style={styles.medicalChip}><Text style={styles.medicalChipText}>AUTO-SHARE READY</Text></View>
          </View>

          <TextInput value={profile.name} onChangeText={(value) => setProfile((current) => ({ ...current, name: value }))} style={styles.input} placeholder="Name" placeholderTextColor="#94A3B8" />
          <View style={styles.inlineRow}>
            <TextInput value={profile.bloodGroup} onChangeText={(value) => setProfile((current) => ({ ...current, bloodGroup: value }))} style={[styles.input, styles.inlineInput]} placeholder="Blood group" placeholderTextColor="#94A3B8" />
            <TextInput value={profile.address} onChangeText={(value) => setProfile((current) => ({ ...current, address: value }))} style={[styles.input, styles.inlineInput]} placeholder="Home area" placeholderTextColor="#94A3B8" />
          </View>
          <TextInput value={profile.conditions} onChangeText={(value) => setProfile((current) => ({ ...current, conditions: value }))} style={styles.input} placeholder="Medical conditions" placeholderTextColor="#94A3B8" />

          <View style={styles.medicalIdBox}>
            <Text style={styles.medicalIdTitle}>My Medical ID</Text>
            <Text style={styles.medicalIdLine}>{profile.name} · Blood Group {profile.bloodGroup}</Text>
            <Text style={styles.medicalIdLine}>Conditions: {profile.conditions}</Text>
            <Text style={styles.medicalIdLine}>Address: {profile.address}</Text>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.switchTitle}>Auto-share Medical ID</Text>
              <Text style={styles.switchSub}>Send this card to first responders when SOS is triggered.</Text>
            </View>
            <Switch value={preferences.autoShareMedicalId} onValueChange={setAutoShareMedicalId} />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.switchTitle}>Voice SOS Always On</Text>
              <Text style={styles.switchSub}>Keeps the wake-word listener active on the home screen.</Text>
            </View>
            <Switch value={preferences.voiceSosEnabled} onValueChange={setVoiceSosEnabled} />
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeaderRow}>
            <Text style={styles.cardTitle}>Emergency contacts</Text>
            <Pressable onPress={addContact} style={styles.addButton}><Text style={styles.addButtonText}>Add contact</Text></Pressable>
          </View>

          {contacts.map((contact, index) => (
            <View key={`${contact.name}-${index}`} style={styles.contactCard}>
              <TextInput value={contact.name} onChangeText={(value) => updateContact(index, 'name', value)} style={styles.input} placeholder="Contact name" placeholderTextColor="#94A3B8" />
              <View style={styles.inlineRow}>
                <TextInput value={contact.relation} onChangeText={(value) => updateContact(index, 'relation', value)} style={[styles.input, styles.inlineInput]} placeholder="Relation" placeholderTextColor="#94A3B8" />
                <TextInput value={contact.phone} onChangeText={(value) => updateContact(index, 'phone', value)} style={[styles.input, styles.inlineInput]} placeholder="Phone" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.profileCard}>
          <Text style={styles.cardTitle}>Emergency readiness</Text>
          <Text style={styles.checkLine}>Blood group: {profile.bloodGroup}</Text>
          <Text style={styles.checkLine}>Known conditions: {profile.conditions}</Text>
          <Text style={styles.checkLine}>Contacts saved: {contacts.length}/3</Text>
        </View>

        <View style={styles.profileCard}>
          <Text style={styles.cardTitle}>Incident History</Text>
          {incidentHistory.length ? (
            incidentHistory.map((item) => (
              <View key={item.reportId} style={styles.historyItem}>
                <Text style={styles.historyTitle}>{item.reportId}</Text>
                <Text style={styles.historyLine}>{item.dateTime}</Text>
                <Text style={styles.historyLine}>{item.trigger} · {item.severity}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.checkLine}>No incidents yet. The last 10 reports will appear here automatically.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FB' },
  container: { padding: 16, gap: 14, paddingBottom: 28 },
  header: { fontSize: 30, fontWeight: '900', color: '#0F172A' },
  subheader: { color: '#475569', lineHeight: 20 },
  profileCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, gap: 12, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  medicalChip: { backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  medicalChipText: { color: '#166534', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: '#0F172A', backgroundColor: '#FBFDFF' },
  inlineRow: { flexDirection: 'row', gap: 10 },
  inlineInput: { flex: 1 },
  medicalIdBox: { borderRadius: 18, backgroundColor: '#0F172A', padding: 14, gap: 4 },
  medicalIdTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  medicalIdLine: { color: '#D1D5DB', fontSize: 13, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchTextWrap: { flex: 1 },
  switchTitle: { color: '#0F172A', fontWeight: '800' },
  switchSub: { color: '#64748B', fontSize: 12, marginTop: 4, lineHeight: 16 },
  addButton: { backgroundColor: '#0F172A', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  addButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  contactCard: { gap: 10, paddingTop: 4 },
  checkLine: { color: '#334155', fontSize: 13, lineHeight: 18 },
  historyItem: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, gap: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  historyTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  historyLine: { color: '#475569', fontSize: 12, lineHeight: 16 },
});