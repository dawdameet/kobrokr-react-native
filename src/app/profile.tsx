import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, ScrollView, Linking, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api, { clearCachedToken } from '../lib/api';
import { storage } from '../lib/storage';
import SubscriptionWidget from '../components/SubscriptionWidget';
import FeedbackModal from '../components/FeedbackModal';
import { logoutPurchases } from '../lib/purchases';
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
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    mobile: '',
    city: '',
    agency_name: '',
    experience: '',
    areas_served: '',
  });

  const handleOpenEditProfile = () => {
    setEditForm({
      full_name: profile?.full_name || '',
      mobile: profile?.mobile || '',
      city: profile?.city || '',
      agency_name: profile?.agency_name || '',
      experience: profile?.experience != null ? String(profile?.experience) : '',
      areas_served: Array.isArray(profile?.areas_served) 
        ? profile.areas_served.join(', ') 
        : (profile?.areas_served || ''),
    });
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    if (!editForm.full_name.trim()) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), 'Full name is required.');
      return;
    }

    setSavingProfile(true);
    try {
      const payload: any = {
        full_name: editForm.full_name.trim(),
        mobile: editForm.mobile.trim(),
        city: editForm.city.trim(),
      };

      if (userRole === 'broker') {
        payload.agency_name = editForm.agency_name.trim();
        payload.experience = editForm.experience ? parseInt(editForm.experience, 10) : 0;
        payload.areas_served = editForm.areas_served
          ? editForm.areas_served.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];
      }

      const { data } = await api.put('/auth/profile', payload);
      setProfile((prev: any) => ({ ...prev, ...data, ...payload }));

      const uStr = await storage.get('user');
      if (uStr) {
        const u = JSON.parse(uStr);
        await storage.set('user', JSON.stringify({ ...u, ...payload, ...data }));
      }

      setShowEditProfileModal(false);
      Alert.alert(t('common.success', { defaultValue: 'Success' }), 'Profile updated successfully!');
    } catch (err: any) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), err.response?.data?.error || 'Failed to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

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
          clearCachedToken();
          await logoutPurchases().catch(() => {});
          await storage.remove('access_token');
          await storage.remove('refresh_token');
          await storage.remove('user');
          router.replace('/');
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
              clearCachedToken();
              await storage.remove('access_token');
              await storage.remove('refresh_token');
              await storage.remove('user');
              Alert.alert('Account Deleted', 'Your account has been deleted.');
              router.replace('/');
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

  const isAgencyOwner =
    userRole === 'broker' &&
    Boolean(profile?.is_admin || profile?.is_agency_owner) &&
    (profile?.plan === 'enterprise' || profile?.plan === 'agency');

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
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
            onPress={handleOpenEditProfile}
          >
            <Ionicons name="create-outline" size={20} color="#374151" />
            <Text style={styles.menuItemText}>{t('profile.editProfile')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </Pressable>
        </View>

        {/* Agency Team Management Section (For Enterprise Admins) */}
        {isAgencyOwner && (
          <Pressable 
            style={styles.agencyTeamCard}
            onPress={() => router.push('/agency-team' as any)}
          >
            <View style={styles.agencyTeamIconContainer}>
              <Ionicons name="people" size={22} color="#2563EB" />
            </View>
            <View style={styles.partnerCardTextContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.partnerCardTitle}>Manage Agency Team</Text>
                <View style={styles.agencyPlanBadge}>
                  <Text style={styles.agencyPlanBadgeText}>ENTERPRISE</Text>
                </View>
              </View>
              <Text style={styles.partnerCardSubtitle}>
                {profile.agency_name ? `${profile.agency_name} • ` : ''}Manage members & seats
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        )}

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

        {/* Payment History & Invoices Section */}
        {userRole === 'broker' && (
          <Pressable 
            style={styles.paymentCard}
            onPress={() => router.push('/payment-history' as any)}
          >
            <View style={styles.paymentCardIconContainer}>
              <Ionicons name="receipt-outline" size={20} color="#2563EB" />
            </View>
            <View style={styles.paymentCardTextContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.paymentCardTitle}>Payment History & Invoices</Text>
                <View style={styles.invoiceBadge}>
                  <Text style={styles.invoiceBadgeText}>GST PDF</Text>
                </View>
              </View>
              <Text style={styles.paymentCardSubtitle}>
                Download tax receipts & view past transactions
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        )}

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
            <Pressable onPress={() => router.push('/terms' as any)}>
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

        {/* Edit Profile Modal */}
        <Modal
          visible={showEditProfileModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            if (!savingProfile) setShowEditProfileModal(false);
          }}
        >
          <SafeAreaView edges={['top', 'bottom']} style={styles.modalContainer}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
            >
              <View style={styles.modalHeader}>
                <Pressable 
                  onPress={() => setShowEditProfileModal(false)} 
                  disabled={savingProfile} 
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCancelText}>{t('common.cancel', { defaultValue: 'Cancel' })}</Text>
                </Pressable>
                <Text style={styles.modalTitle}>{t('profile.editProfile')}</Text>
                <Pressable 
                  onPress={handleSaveProfile} 
                  disabled={savingProfile} 
                  style={styles.modalSaveBtn}
                >
                  {savingProfile ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : (
                    <Text style={styles.modalSaveText}>{t('common.save', { defaultValue: 'Save' })}</Text>
                  )}
                </Pressable>
              </View>

              <ScrollView 
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('profile.name', { defaultValue: 'Full Name' })} *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editForm.full_name}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, full_name: val }))}
                    placeholder="Enter your full name"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('profile.mobile', { defaultValue: 'Mobile Number' })}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editForm.mobile}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, mobile: val }))}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('profile.city', { defaultValue: 'City' })}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editForm.city}
                    onChangeText={(val) => setEditForm(prev => ({ ...prev, city: val }))}
                    placeholder="e.g. Mumbai"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {userRole === 'broker' && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>{t('profile.agency', { defaultValue: 'Agency / Firm Name' })}</Text>
                      <TextInput
                        style={styles.textInput}
                        value={editForm.agency_name}
                        onChangeText={(val) => setEditForm(prev => ({ ...prev, agency_name: val }))}
                        placeholder="e.g. Skyline Realty"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Experience (Years)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={editForm.experience}
                        onChangeText={(val) => setEditForm(prev => ({ ...prev, experience: val }))}
                        placeholder="e.g. 5"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Areas Served (Comma separated)</Text>
                      <TextInput
                        style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                        value={editForm.areas_served}
                        onChangeText={(val) => setEditForm(prev => ({ ...prev, areas_served: val }))}
                        placeholder="e.g. Bandra West, Khar, Santacruz"
                        placeholderTextColor="#9CA3AF"
                        multiline
                      />
                    </View>
                  </>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

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
  agencyTeamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  agencyTeamIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  agencyPlanBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  agencyPlanBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 9,
    fontWeight: '700',
    color: '#7E22CE',
    letterSpacing: 0.5,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  paymentCardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentCardTextContainer: {
    flex: 1,
  },
  paymentCardTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#111827',
  },
  paymentCardSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  invoiceBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  invoiceBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 9,
    color: '#16A34A',
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: Fonts.sansMedium,
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: Fonts.displaySemiBold,
    fontWeight: '700',
    color: '#111827',
  },
  modalSaveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  modalSaveText: {
    fontSize: 15,
    fontFamily: Fonts.sansBold,
    fontWeight: '700',
    color: '#2563EB',
  },
  modalScrollContent: {
    padding: 16,
    gap: 16,
  },
  inputGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  textInput: {
    fontSize: 15,
    fontFamily: Fonts.sans,
    color: '#111827',
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
});
