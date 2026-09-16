import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Share,
  Linking,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { storage } from '../lib/storage';
import { safeGoBack } from '../lib/utils';
import { Fonts } from '../constants/theme';
import api from '../lib/api';

const QUICK_UPI_HANDLES = ['@okhdfcbank', '@okaxis', '@paytm', '@ybl', '@icici'];

export default function PartnerScreen() {
  const [user, setUser] = useState<any>(null);
  const [referralCode, setReferralCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [modalUpiId, setModalUpiId] = useState('');
  const [savingUpi, setSavingUpi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'whatsapp' | 'copy' | 'share' | null>(null);

  // Live or fallback stats
  const [stats, setStats] = useState({
    totalReferrals: 0,
    paidConversions: 0,
    totalEarned: 0,
    pendingPayout: 0,
    commissionRate: 15,
  });

  useEffect(() => {
    async function loadPartnerData() {
      try {
        const userStr = await storage.get('user');
        if (userStr) {
          const parsedUser = JSON.parse(userStr);
          setUser(parsedUser);

          if (parsedUser.referral_code) {
            setReferralCode(parsedUser.referral_code);
          } else {
            const namePrefix = (parsedUser.full_name || 'USER')
              .replace(/[^A-Za-z0-9]/g, '')
              .substring(0, 4)
              .toUpperCase();
            const idSuffix = (parsedUser.id || '9999').replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase();
            const derivedCode = `KB-${namePrefix || 'PART'}-${idSuffix}`;
            setReferralCode(derivedCode);
          }

          if (parsedUser.upi_id) {
            setUpiId(parsedUser.upi_id);
            setModalUpiId(parsedUser.upi_id);
          }
        }

        const savedUpi = await storage.get('affiliate_upi_id');
        if (savedUpi) {
          setUpiId(savedUpi);
          setModalUpiId(savedUpi);
        }

        // Fetch live affiliate stats from backend
        try {
          const { data } = await api.get('/affiliate/overview');
          if (data) {
            setStats({
              totalReferrals: data.totalReferrals || 0,
              paidConversions: data.paidConversions || 0,
              totalEarned: data.totalEarned || 0,
              pendingPayout: data.pendingPayout || 0,
              commissionRate: data.commissionRate || 15,
            });
            if (data.referral_code) setReferralCode(data.referral_code);
            if (data.upi_id) {
              setUpiId(data.upi_id);
              setModalUpiId(data.upi_id);
              await storage.set('affiliate_upi_id', data.upi_id);
            }
          }
        } catch {
          // Fallback to local state if backend route is syncing
        }
      } catch (e) {
        console.error('Failed to load partner data', e);
      } finally {
        setLoading(false);
      }
    }
    loadPartnerData();
  }, []);

  const referralLink = `https://kobrokr.com/pricing?ref=${encodeURIComponent(referralCode)}`;

  // Save UPI ID to backend database and local storage
  const persistUpiId = async (idToSave: string): Promise<boolean> => {
    const cleanUpi = idToSave.trim();
    if (!cleanUpi || !cleanUpi.includes('@')) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI address (e.g. name@okhdfcbank or 9876543210@paytm).');
      return false;
    }

    setSavingUpi(true);
    try {
      // 1. Save to backend database
      try {
        await api.post('/affiliate/payout-settings', { upi_id: cleanUpi });
      } catch (err) {
        console.warn('Backend sync failed, saved locally', err);
      }

      // 2. Save to local storage
      await storage.set('affiliate_upi_id', cleanUpi);
      setUpiId(cleanUpi);
      setModalUpiId(cleanUpi);

      // 3. Update cached user in storage
      if (user) {
        const updatedUser = { ...user, upi_id: cleanUpi };
        setUser(updatedUser);
        await storage.set('user', JSON.stringify(updatedUser));
      }

      return true;
    } catch (e) {
      Alert.alert('Error', 'Failed to save UPI ID. Please try again.');
      return false;
    } finally {
      setSavingUpi(false);
    }
  };

  const executeAction = (action: 'whatsapp' | 'copy' | 'share' | null) => {
    if (action === 'copy') {
      doCopy();
    } else if (action === 'whatsapp') {
      doWhatsApp();
    } else if (action === 'share') {
      doNativeShare();
    }
  };

  const doCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    Alert.alert(
      'Code Copied!',
      `Referral code ${referralCode} copied. Anyone who enters this at signup or checkout earns you ${stats.commissionRate}% recurring commission!`
    );
  };

  const doWhatsApp = () => {
    const message = `Hey! Check out kobrokr — it's the best platform for real estate brokers and tenants.\n\nUse my referral code *${referralCode}* or click my link to get started:\n${referralLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to open WhatsApp', 'Please ensure WhatsApp is installed on your device.');
    });
  };

  const doNativeShare = async () => {
    try {
      await Share.share({
        title: 'Join kobrokr with my referral code',
        message: `Join me on kobrokr! Real estate brokers and tenants collaborate faster with zero hassle. Sign up or upgrade using my referral code ${referralCode}:\n${referralLink}`,
        url: referralLink,
      });
    } catch (e) {
      console.error('Share failed', e);
    }
  };

  const handleCopyCode = () => {
    if (!upiId.trim()) {
      setPendingAction('copy');
      setShowUpiModal(true);
      return;
    }
    doCopy();
  };

  const handleShareWhatsApp = () => {
    if (!upiId.trim()) {
      setPendingAction('whatsapp');
      setShowUpiModal(true);
      return;
    }
    doWhatsApp();
  };

  const handleNativeShare = () => {
    if (!upiId.trim()) {
      setPendingAction('share');
      setShowUpiModal(true);
      return;
    }
    doNativeShare();
  };

  const handleModalSaveUpi = async () => {
    const success = await persistUpiId(modalUpiId);
    if (success) {
      setShowUpiModal(false);
      Alert.alert(
        '🎉 Link Activated!',
        `Payouts configured to ${modalUpiId}. Your 15% recurring commissions will be automatically deposited via Razorpay every Tuesday.`
      );
      executeAction(pendingAction);
      setPendingAction(null);
    }
  };

  const handleModalSkip = () => {
    setShowUpiModal(false);
    executeAction(pendingAction);
    setPendingAction(null);
  };

  const handleAppendHandle = (handle: string) => {
    const base = modalUpiId.split('@')[0];
    if (base) {
      setModalUpiId(`${base}${handle}`);
    } else {
      setModalUpiId(handle);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => safeGoBack('/profile')}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Partner & Affiliate Hub</Text>
            <Text style={styles.headerSubtitle}>Refer anyone & earn {stats.commissionRate}% on every sale</Text>
          </View>
          <View style={styles.badgeTop}>
            <Text style={styles.badgeTopText}>{stats.commissionRate}% COMMISSION</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* UPI Setup Alert if not registered yet */}
          {!upiId.trim() ? (
            <Pressable
              style={styles.upiPromptBanner}
              onPress={() => {
                setPendingAction(null);
                setShowUpiModal(true);
              }}
            >
              <View style={styles.upiPromptIconBox}>
                <Ionicons name="wallet" size={22} color="#D97706" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.upiPromptTitle}>Register UPI ID for Direct Payouts</Text>
                <Text style={styles.upiPromptSub}>
                  Tap to add your UPI address so your 15% commission can be cashed out via Razorpay.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D97706" />
            </Pressable>
          ) : (
            <View style={styles.upiActiveBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#15803D" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.upiActiveTitle}>Direct Razorpay Payouts Active</Text>
                <Text style={styles.upiActiveSub}>Settling weekly to: <Text style={{ fontWeight: '700' }}>{upiId}</Text></Text>
              </View>
              <Pressable
                onPress={() => {
                  setPendingAction(null);
                  setShowUpiModal(true);
                }}
                style={styles.upiEditBtn}
              >
                <Text style={styles.upiEditBtnText}>Edit</Text>
              </Pressable>
            </View>
          )}

          {/* Hero Banner */}
          <View style={styles.heroCard}>
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroIconBox}>
                <Ionicons name="gift-outline" size={24} color="#2563EB" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.heroTitle}>Universal Referral Program</Text>
                <Text style={styles.heroSubtitle}>
                  Free or paid, broker or tenant — share your link with anyone. When they buy any kobrokr plan, you earn cash payouts via Razorpay!
                </Text>
              </View>
            </View>
          </View>

          {/* Referral Code Card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>YOUR UNIQUE REFERRAL CODE</Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>{referralCode || 'KB-PARTNER'}</Text>
              <Pressable style={styles.copyButton} onPress={handleCopyCode}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color="#2563EB" />
                <Text style={styles.copyButtonText}>{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            </View>

            <Text style={styles.linkUrlText}>{referralLink}</Text>

            <View style={styles.shareButtonsRow}>
              <Pressable style={styles.whatsappButton} onPress={handleShareWhatsApp}>
                <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                <Text style={styles.whatsappButtonText}>Share on WhatsApp</Text>
              </Pressable>

              <Pressable style={styles.shareButton} onPress={handleNativeShare}>
                <Ionicons name="share-social-outline" size={20} color="#374151" />
                <Text style={styles.shareButtonText}>More</Text>
              </Pressable>
            </View>
          </View>

          {/* Dual Entry Explanation Banner */}
          <View style={styles.dualInfoBanner}>
            <Ionicons name="checkmark-done-circle" size={22} color="#15803D" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.dualInfoTitle}>Dual-Path Referral Support</Text>
              <Text style={styles.dualInfoText}>
                • <Text style={{ fontWeight: '700' }}>Clicked your link?</Text> Your code is auto-filled at signup and checkout.
                {'\n'}• <Text style={{ fontWeight: '700' }}>Direct visitor?</Text> They can manually type your code at checkout.
              </Text>
            </View>
          </View>

          {/* Stats Overview */}
          <Text style={styles.sectionHeader}>Your Earnings & Performance</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.totalReferrals}</Text>
              <Text style={styles.statLabel}>Total Referrals</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.paidConversions}</Text>
              <Text style={styles.statLabel}>Upgrades</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#15803D' }]}>₹{stats.totalEarned}</Text>
              <Text style={styles.statLabel}>Total Earned</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#D97706' }]}>₹{stats.pendingPayout}</Text>
              <Text style={styles.statLabel}>Pending Payout</Text>
            </View>
          </View>

          {/* Razorpay UPI Payout Settings */}
          <View style={styles.card}>
            <View style={styles.payoutHeader}>
              <View style={styles.payoutIconBox}>
                <Ionicons name="wallet-outline" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.cardTitle}>Razorpay UPI Payouts</Text>
                <Text style={styles.payoutSub}>
                  Commissions are settled automatically to your UPI ID every Tuesday.
                </Text>
              </View>
            </View>

            <View style={styles.upiInputRow}>
              <TextInput
                style={styles.upiInput}
                placeholder="Enter UPI ID (e.g. name@okhdfcbank)"
                placeholderTextColor="#9CA3AF"
                value={upiId}
                onChangeText={setUpiId}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={[styles.saveUpiButton, savingUpi && { opacity: 0.7 }]}
                onPress={async () => {
                  const success = await persistUpiId(upiId);
                  if (success) {
                    Alert.alert('Payout Details Saved', `Commissions will be automatically settled to ${upiId.trim()} via Razorpay.`);
                  }
                }}
                disabled={savingUpi}
              >
                {savingUpi ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveUpiButtonText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* How It Works */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>How It Works</Text>

            <View style={styles.stepRow}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.stepTitle}>Register UPI & share link</Text>
                <Text style={styles.stepDesc}>
                  Enter your UPI ID so earnings deposit automatically, then share your code or WhatsApp link.
                </Text>
              </View>
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.stepTitle}>They register or check out</Text>
                <Text style={styles.stepDesc}>
                  Your code is auto-filled at signup and checkout, or entered manually when choosing a plan.
                </Text>
              </View>
            </View>

            <View style={[styles.stepRow, { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 }]}>
              <View style={[styles.stepNumberBadge, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.stepNumberText, { color: '#15803D' }]}>3</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.stepTitle}>Earn recurring commission</Text>
                <Text style={styles.stepDesc}>
                  Receive 15% on each purchase credited and deposited directly to your UPI ID via Razorpay.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* UPI Registration Modal when generating/sharing link */}
        <Modal
          visible={showUpiModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowUpiModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="gift" size={24} color="#2563EB" />
                </View>
                <Pressable onPress={() => setShowUpiModal(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={22} color="#6B7280" />
                </Pressable>
              </View>

              <Text style={styles.modalTitle}>Where should we send your 15% commission?</Text>
              <Text style={styles.modalSubtitle}>
                Register your UPI address to activate your partner link and receive automatic weekly cashouts via Razorpay.
              </Text>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>UPI ID (GPay / PhonePe / Paytm / Bank) *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. yourname@okhdfcbank"
                  placeholderTextColor="#9CA3AF"
                  value={modalUpiId}
                  onChangeText={setModalUpiId}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Quick Handle Chips */}
              <View style={styles.chipsRow}>
                {QUICK_UPI_HANDLES.map((handle) => (
                  <Pressable
                    key={handle}
                    style={styles.chipButton}
                    onPress={() => handleAppendHandle(handle)}
                  >
                    <Text style={styles.chipText}>{handle}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Action Buttons */}
              <Pressable
                style={[styles.modalActivateBtn, savingUpi && { opacity: 0.7 }]}
                onPress={handleModalSaveUpi}
                disabled={savingUpi}
              >
                {savingUpi ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalActivateBtnText}>Save UPI & Activate Link →</Text>
                )}
              </Pressable>

              <Pressable style={styles.modalSkipBtn} onPress={handleModalSkip}>
                <Text style={styles.modalSkipBtnText}>I'll add it later (Continue to share)</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
  },
  badgeTop: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTopText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#2563EB',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
    gap: 16,
  },
  upiPromptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
  },
  upiPromptIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiPromptTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '700',
    marginBottom: 2,
  },
  upiPromptSub: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#B45309',
    lineHeight: 15,
  },
  upiActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 12,
  },
  upiActiveTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#15803D',
    fontWeight: '600',
  },
  upiActiveSub: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#166534',
  },
  upiEditBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 6,
  },
  upiEditBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: '#15803D',
  },
  heroCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 16,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#1E3A8A',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardSectionLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  codeText: {
    fontFamily: Fonts.monoSemiBold,
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 1.5,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  copyButtonText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  linkUrlText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  shareButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  whatsappButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  whatsappButtonText: {
    fontFamily: Fonts.sansBold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  shareButtonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  dualInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 14,
  },
  dualInfoTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: '#15803D',
    fontWeight: '700',
    marginBottom: 2,
  },
  dualInfoText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
  },
  sectionHeader: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
  },
  payoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  payoutIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  payoutSub: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  upiInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  upiInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#111827',
  },
  saveUpiButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveUpiButtonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
  },
  stepTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    marginBottom: 2,
  },
  stepDesc: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 20,
  },
  modalInputGroup: {
    marginBottom: 12,
  },
  modalInputLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
  },
  modalInput: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: '#111827',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chipButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#4B5563',
  },
  modalActivateBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalActivateBtnText: {
    fontFamily: Fonts.sansBold,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSkipBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalSkipBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#6B7280',
  },
});
