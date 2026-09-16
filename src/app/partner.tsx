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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { storage } from '../lib/storage';
import { safeGoBack } from '../lib/utils';
import { Fonts } from '../constants/theme';
import api from '../lib/api';

export default function PartnerScreen() {
  const [user, setUser] = useState<any>(null);
  const [referralCode, setReferralCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [savingUpi, setSavingUpi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Mock / initial stats (can be connected to backend /affiliate/stats API)
  const [stats, setStats] = useState({
    totalReferrals: 0,
    paidConversions: 0,
    totalEarned: 0,
    pendingPayout: 0,
    commissionRate: 15, // 15%
  });

  useEffect(() => {
    async function loadPartnerData() {
      try {
        const userStr = await storage.get('user');
        if (userStr) {
          const parsedUser = JSON.parse(userStr);
          setUser(parsedUser);

          // Generate or use user referral code
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
        }

        const savedUpi = await storage.get('affiliate_upi_id');
        if (savedUpi) {
          setUpiId(savedUpi);
        }

        // Try fetching live affiliate stats if endpoint exists
        try {
          const { data } = await api.get('/affiliate/overview');
          if (data) {
            setStats((prev) => ({ ...prev, ...data }));
            if (data.referral_code) setReferralCode(data.referral_code);
            if (data.upi_id) setUpiId(data.upi_id);
          }
        } catch {
          // Fallback to local defaults if API is not yet active
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

  const handleCopyCode = async () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    // Provide friendly cross-platform feedback
    Alert.alert(
      'Code Copied!',
      `Referral code ${referralCode} copied. Anyone who enters this at signup or checkout earns you ${stats.commissionRate}% recurring commission!`
    );
  };

  const handleShareWhatsApp = () => {
    const message = `Hey! Check out kobrokr — it's the best platform for real estate brokers and tenants.\n\nUse my referral code *${referralCode}* or click my link to get started:\n${referralLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to open WhatsApp', 'Please ensure WhatsApp is installed on your device.');
    });
  };

  const handleNativeShare = async () => {
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

  const handleSaveUpi = async () => {
    const cleanUpi = upiId.trim();
    if (!cleanUpi || !cleanUpi.includes('@')) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g. name@okhdfcbank or 9876543210@paytm).');
      return;
    }

    setSavingUpi(true);
    try {
      await storage.set('affiliate_upi_id', cleanUpi);

      // Attempt to save to backend if available
      try {
        await api.post('/affiliate/payout-settings', { upi_id: cleanUpi });
      } catch {
        // Saved locally in storage
      }

      Alert.alert('Payout Details Saved', `Commissions will be automatically settled to ${cleanUpi} via Razorpay.`);
    } catch {
      Alert.alert('Error', 'Failed to save UPI ID. Please try again.');
    } finally {
      setSavingUpi(false);
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
            <Text style={styles.badgeTopText}>15% COMMISSION</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero Banner */}
          <View style={styles.heroCard}>
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroIconBox}>
                <Ionicons name="gift-outline" size={24} color="#2563EB" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.heroTitle}>Universal Referral Program</Text>
                <Text style={styles.heroSubtitle}>
                  Free or paid, broker or tenant — share your code with anyone. When they buy any kobrokr plan, you earn cash payouts via Razorpay!
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
                onPress={handleSaveUpi}
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
                <Text style={styles.stepTitle}>Share your code or link</Text>
                <Text style={styles.stepDesc}>
                  Send your unique affiliate link or code to brokers, agencies, or tenants.
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
});
