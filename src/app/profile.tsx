import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { storage } from '../lib/storage';
import SubscriptionWidget from '../components/SubscriptionWidget';
import FeedbackModal from '../components/FeedbackModal';
import { safeGoBack } from '../lib/utils';
import { Fonts } from '../constants/theme';
import { SUPPORTED_LANGUAGES, setAppLanguage } from '../i18n';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [affiliateStats, setAffiliateStats] = useState<any>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  useEffect(() => {
    async function init() {
      const uStr = await storage.get('user');
      if (uStr) {
        const u = JSON.parse(uStr);
        setUserRole(u.role);
        fetchProfile(u.role);
        fetchAffiliateStats();
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

  const fetchAffiliateStats = async () => {
    try {
      const { data } = await api.get('/affiliate/overview');
      if (data && (data.totalReferrals !== undefined || data.total_referrals !== undefined)) {
        setAffiliateStats({
          total_referrals: data.totalReferrals ?? data.total_referrals ?? 0,
          total_earned: String(data.totalEarned ?? data.settled_earnings ?? 0),
          pending_payout: String(data.pendingPayout ?? data.pending_earnings ?? 0),
        });
      }
    } catch (e) {
      // Not a partner yet - leave affiliateStats as null
    }
  };

  const handleLogout = async () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { 
        text: t('profile.logout'), 
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

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? All your listings and data will be removed. This action cannot be undone.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              try {
                await api.delete('/auth/profile');
              } catch (e) {
                console.warn('Backend delete profile failed or unsupported:', e);
              }
              await storage.remove('access_token');
              await storage.remove('refresh_token');
              await storage.remove('user');
              Alert.alert('Account Deleted', 'Your account has been deleted.');
              router.replace('/login');
            } catch (err) {
              Alert.alert('Error', 'Unable to complete deletion request. Please contact support@kobrokr.com');
            }
          },
        },
      ]
    );
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
        <Text style={styles.errorText}>{error ? t('profile.errorLoading') : t('profile.notFound')}</Text>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>{t('profile.logoutAnyway')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const currentLangCode = i18n.language || 'en';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
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
          <Text style={styles.cardTitle}>{t('profile.accountInfo')}</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#6B7280" style={styles.infoIcon} />
            <View>
              <Text style={styles.infoLabel}>{t('profile.email')}</Text>
              <Text style={styles.infoValue}>{profile.email}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color="#6B7280" style={styles.infoIcon} />
            <View>
              <Text style={styles.infoLabel}>{t('profile.mobile')}</Text>
              <Text style={styles.infoValue}>{profile.mobile || t('profile.notProvided')}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#6B7280" style={styles.infoIcon} />
            <View>
              <Text style={styles.infoLabel}>{t('profile.city')}</Text>
              <Text style={styles.infoValue}>{profile.city || t('profile.notProvided')}</Text>
            </View>
          </View>

          {userRole === 'broker' && profile.agency_name && (
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={20} color="#6B7280" style={styles.infoIcon} />
              <View>
                <Text style={styles.infoLabel}>{t('profile.agency')}</Text>
                <Text style={styles.infoValue}>{profile.agency_name}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Language Selection Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="globe-outline" size={18} color="#2563EB" />
            <Text style={styles.cardTitle}>{t('profile.language')}</Text>
          </View>
          <Text style={styles.cardSubtitle}>{t('profile.languageNotice')}</Text>

          <View style={styles.languageOptionsContainer}>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = currentLangCode.startsWith(lang.code);
              return (
                <Pressable
                  key={lang.code}
                  style={[styles.languageOption, isSelected && styles.languageOptionSelected]}
                  onPress={() => setAppLanguage(lang.code)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.languageNativeLabel, isSelected && styles.languageTextSelected]}>
                      {lang.nativeLabel}
                    </Text>
                    <Text style={[styles.languageEnglishLabel, isSelected && styles.languageSubtextSelected]}>
                      {lang.label}
                    </Text>
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={22} color="#2563EB" />
                  ) : (
                    <Ionicons name="ellipse-outline" size={22} color="#D1D5DB" />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Action Section */}
        <View style={styles.card}>
          <Pressable 
            style={[styles.menuItem, { borderBottomWidth: 0 }]} 
            onPress={() => Alert.alert(t('common.comingSoon'), t('profile.editProfileNotice'))}
          >
            <Ionicons name="create-outline" size={20} color="#374151" />
            <Text style={styles.menuItemText}>{t('profile.editProfile')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </Pressable>
        </View>

        {/* Partner Program Section */}
        <Pressable 
          style={styles.partnerCard}
          onPress={() => router.push('/partner' as any)}
        >
          <View style={styles.partnerCardIconContainer}>
            <Ionicons name="briefcase" size={20} color="#2563EB" />
          </View>
          <View style={styles.partnerCardTextContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.partnerCardTitle}>{affiliateStats ? t('profile.yourPartnerStats') : t('profile.partnerProgram')}</Text>
              <View style={styles.partnerBadge}>
                <Text style={styles.partnerBadgeText}>{t('profile.partnerBadge')}</Text>
              </View>
            </View>
            <Text style={styles.partnerCardSubtitle}>
              {affiliateStats 
                ? `${affiliateStats.total_referrals} ${t('profile.referrals')} | ₹${affiliateStats.total_earned} ${t('profile.earned')} | ₹${affiliateStats.pending_payout} ${t('profile.pending')}` 
                : t('profile.joinPartner')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>

        {userRole === 'broker' && <SubscriptionWidget />}

        {/* Help & Support Section */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="help-buoy-outline" size={18} color="#2563EB" />
            <Text style={styles.cardTitle}>Help & Support</Text>
          </View>
          <Text style={styles.cardSubtitle}>Need assistance, have queries, or want to share feedback?</Text>

          <View style={styles.supportOptionsContainer}>
            {/* Email Support */}
            <Pressable
              style={styles.supportOptionRow}
              onPress={() => Linking.openURL('mailto:support@kobrokr.com?subject=KoBrokr%20Support%20Request')}
            >
              <View style={[styles.supportIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="mail" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportOptionTitle}>Email Support</Text>
                <Text style={styles.supportOptionSub}>support@kobrokr.com • 24hr response</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>

            {/* WhatsApp Support */}
            <Pressable
              style={styles.supportOptionRow}
              onPress={() => Linking.openURL('https://wa.me/919820000000?text=Hi%20KoBrokr%20Support%2C%20I%20need%20assistance%20with...')}
            >
              <View style={[styles.supportIconWrapper, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportOptionTitle}>WhatsApp Support</Text>
                <Text style={styles.supportOptionSub}>Chat with our Mumbai broker helpdesk</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>

            {/* In-app Feedback Modal */}
            <Pressable
              style={[styles.supportOptionRow, { borderBottomWidth: 0 }]}
              onPress={() => setShowFeedbackModal(true)}
            >
              <View style={[styles.supportIconWrapper, { backgroundColor: '#FAF5FF' }]}>
                <Ionicons name="chatbox-ellipses" size={18} color="#7E22CE" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportOptionTitle}>Send Feedback</Text>
                <Text style={styles.supportOptionSub}>Rate experience & suggest new features</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Legal Links */}
          <View style={styles.supportLegalRow}>
            <Pressable onPress={() => Linking.openURL('https://www.kobrokr.com/privacy')}>
              <Text style={styles.supportLegalLink}>Privacy Policy</Text>
            </Pressable>
            <Text style={styles.supportLegalDot}>•</Text>
            <Pressable onPress={() => Linking.openURL('https://www.kobrokr.com/terms')}>
              <Text style={styles.supportLegalLink}>Terms of Service</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutBtnText}>{t('profile.logout')}</Text>
        </Pressable>

        <Pressable style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
          <Text style={styles.deleteBtnText}>Delete Account</Text>
        </Pressable>

        <FeedbackModal
          visible={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          userEmail={profile?.email}
          userName={profile?.full_name}
        />

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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  languageOptionsContainer: {
    gap: 8,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  languageOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  languageNativeLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  languageEnglishLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  languageTextSelected: {
    color: '#1D4ED8',
  },
  languageSubtextSelected: {
    color: '#3B82F6',
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
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 6,
  },
  deleteBtnText: {
    fontFamily: Fonts.sansMedium,
    color: '#9CA3AF',
    fontSize: 13,
  },
  supportOptionsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 14,
  },
  supportOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  supportIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportOptionTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  supportOptionSub: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  supportLegalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  supportLegalLink: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#64748B',
  },
  supportLegalDot: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#CBD5E1',
    marginHorizontal: 8,
  },
});
