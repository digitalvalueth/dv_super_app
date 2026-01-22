import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, SafeAreaView } from 'react-native';
import { ChevronLeft, User, Moon, Bell, Shield, HelpCircle, LogOut, ChevronRight, Zap, Globe, Smartphone, Crown } from 'lucide-react-native';

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionContent}>
      {children}
    </View>
  </View>
);

const SettingItem = ({ icon: Icon, color, label, value, type = 'arrow', onPress }) => (
  <TouchableOpacity
    style={styles.item}
    onPress={onPress}
    activeOpacity={type === 'switch' ? 1 : 0.7}
    disabled={type === 'switch'}
  >
    <View style={styles.itemLeft}>
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        <Icon size={20} color="#fff" />
      </View>
      <Text style={styles.itemLabel}>{label}</Text>
    </View>

    <View style={styles.itemRight}>
      {type === 'switch' && (
        <Switch
          value={value}
          onValueChange={onPress}
          trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
          thumbColor={value ? '#4F46E5' : '#fff'}
          ios_backgroundColor="#E2E8F0"
        />
      )}
      {type === 'text' && (
        <Text style={styles.valueText}>{value}</Text>
      )}
      {type === 'arrow' && (
        <ChevronRight size={20} color="#94A3B8" />
      )}
    </View>
  </TouchableOpacity>
);

const SettingsScreen = ({ navigation }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={28} color="#334155" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>JD</Text>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>John Doe</Text>
            </View>
            <Text style={styles.profileEmail}>john.doe@example.com</Text>
          </View>
        </View>

        {/* Account Section */}
        <Section title="Account">
          <SettingItem
            icon={User}
            color="#6366F1" // Indigo
            label="Personal Details"
            onPress={() => Alert.alert("Demo", "Edit profile demo")}
          />
          <SettingItem
            icon={Shield}
            color="#10B981" // Emerald
            label="Privacy & Security"
            onPress={() => Alert.alert("Demo", "Security settings demo")}
          />
        </Section>

        {/* Preferences Section */}
        <Section title="Preferences">
          <SettingItem
            icon={Moon}
            color="#8B5CF6" // Violet
            label="Dark Mode"
            type="switch"
            value={isDarkMode}
            onPress={(val) => setIsDarkMode(val)}
          />
          <SettingItem
            icon={Bell}
            color="#F59E0B" // Amber
            label="Notifications"
            type="switch"
            value={notifications}
            onPress={(val) => setNotifications(val)}
          />
          <SettingItem
            icon={Globe}
            color="#3B82F6" // Blue
            label="Language"
            type="text"
            value="English"
            onPress={() => Alert.alert("Language", "Change language demo")}
          />
        </Section>

        {/* Recording Section */}
        <Section title="Recording">
          <SettingItem
            icon={Zap}
            color="#EC4899" // Pink
            label="Audio Quality"
            type="text"
            value="High (m4a)"
            onPress={() => Alert.alert("Quality", "Select bitrate/format")}
          />
          <SettingItem
            icon={Smartphone}
            color="#64748B" // Slate
            label="Auto-Save to Cloud"
            type="switch"
            value={autoSave}
            onPress={(val) => setAutoSave(val)}
          />
        </Section>

        {/* Support Section */}
        <Section title="Support">
          <SettingItem
            icon={HelpCircle}
            color="#0EA5E9" // Sky
            label="Help & FAQ"
            onPress={() => Alert.alert("Help", "Opening matching FAQ...")}
          />
          <SettingItem
            icon={LogOut}
            color="#EF4444" // Red
            label="Log Out"
            onPress={() => Alert.alert("Logout", "Are you sure?", [{ text: "Cancel" }, { text: "Log Out", style: "destructive" }])}
          />
        </Section>

        <Text style={styles.versionText}>Version 1.0.2 (Build 20251201)</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  content: {
    padding: 20,
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4F46E5',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748B',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemLabel: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },

  versionText: {
    textAlign: 'center',
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '500',
  }
});

export default SettingsScreen;
