import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../lib/api';
import { storage } from '../lib/storage';
import SubscriptionWidget from '../components/SubscriptionWidget';
import { safeGoBack } from '../lib/utils';
import { Fonts } from '../constants/theme';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const uStr = await storage.get('user');
      if (uStr) {
        const u = JSON.parse(uStr);
        setUserRole(u.role);
        fetchProfile(u.role);
      } else {
        setError('Not logged in');
        setLoading(false);
      }
    }
    init();
  }, []);

  const fetchProfile = async (_role: string) => {
    try {
      const { data } = await api.get('/auth/profile');
      setProfile(data);
    } catch (e) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Log Out', 
        style: 'destructive',
        onPress: async () => {
          await storage.remove('access_token');
          await storage.remove('refresh_token');
          await storage.remove('user');
          router.replace('/login');
        }
      }
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>{error || 'Profile not found'}</Text>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Log Out Anyway</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{profile.full_name?.[0] || profile.email?.[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{profile.full_name || 'User'}</Text>
          <Text style={styles.roleBadge}>{userRole === 'tenant' ? 'TENANT' : 'BROKER'}</Text>
        </View>

        {/* Info Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Information</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#6B7280" style={styles.infoIcon} />
            <View>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile.email}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color="#6B7280" style={styles.infoIcon} />
            <View>
              <Text style={styles.infoLabel}>Mobile Number</Text>
              <Text style={styles.infoValue}>{profile.mobile || 'Not provided'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#6B7280" style={styles.infoIcon} />
            <View>
              <Text style={styles.infoLabel}>City</Text>
              <Text style={styles.infoValue}>{profile.city || 'Not provided'}</Text>
            </View>
          </View>

          {userRole === 'broker' && profile.agency_name && (
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={20} color="#6B7280" style={styles.infoIcon} />
              <View>
                <Text style={styles.infoLabel}>Agency</Text>
                <Text style={styles.infoValue}>{profile.agency_name}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Action Section */}
        <View style={styles.card}>
          <Pressable style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => Alert.alert('Coming Soon', 'Edit profile will be available in a future update.')}>
            <Ionicons name="create-outline" size={20} color="#374151" />
            <Text style={styles.menuItemText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </Pressable>
        </View>

        {/* Become a Partner Section */}
        <Pressable 
          style={styles.partnerCard}
          onPress={() => {}}
        >
          <View style={styles.partnerCardIconContainer}>
            <Ionicons name="briefcase" size={20} color="#2563EB" />
          </View>
          <View style={styles.partnerCardTextContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.partnerCardTitle}>BECOME A PARTNER</Text>
              <View style={styles.partnerBadge}>
                <Text style={styles.partnerBadgeText}>AFFILIATE</Text>
              </View>
            </View>
            <Text style={styles.partnerCardSubtitle}>Join the kobrokr affiliate network</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>

        {userRole === 'broker' && <SubscriptionWidget />}

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarInitials: {
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '700',
    color: '#2563EB',
  },
  name: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  roleBadge: {
    fontFamily: Fonts.monoMedium,
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIcon: {
    marginRight: 16,
    width: 24,
    textAlign: 'center',
  },
  infoLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemText: {
    fontFamily: Fonts.sansMedium,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 12,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    padding: 16,
    marginBottom: 16,
  },
  partnerCardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  partnerCardTextContainer: {
    flex: 1,
  },
  partnerCardTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.3,
  },
  partnerCardSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  partnerBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  partnerBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 9,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  logoutBtnText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontFamily: Fonts.sans,
    color: '#EF4444',
    fontSize: 16,
    marginBottom: 16,
  }
});
