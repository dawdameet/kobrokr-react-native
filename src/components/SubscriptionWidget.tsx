import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { storage } from '../lib/storage';
import { Fonts } from '../constants/theme';

export default function SubscriptionWidget() {
  const [limits, setLimits] = useState<any>(null);
  const [pricing, setPricing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [referralInput, setReferralInput] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [referralError, setReferralError] = useState('');

  useEffect(() => {
    fetchData();
    checkReferralCode();
  }, []);

  const checkReferralCode = async () => {
    try {
      const saved = await storage.get('applied_referral_code');
      if (saved) {
        const clean = saved.trim().toUpperCase();
        setAppliedCode(clean);
        setReferralInput(clean);
      }
    } catch (e) {
      console.error('Error loading referral code', e);
    }
  };

  const handleApplyCode = async () => {
    const code = referralInput.trim().toUpperCase();
    if (!code) {
      setReferralError('Please enter a referral code');
      return;
    }
    setReferralError('');
    setAppliedCode(code);
    await storage.set('applied_referral_code', code);
  };

  const handleRemoveCode = async () => {
    setAppliedCode('');
    setReferralInput('');
    setReferralError('');
    await storage.remove('applied_referral_code');
  };

  const fetchData = async () => {
    try {
      const [limitRes, pricingRes] = await Promise.all([
        api.get('/properties/limits'),
        api.get('/settings/pricing')
      ]);
      setLimits(limitRes.data);
      setPricing(pricingRes.data);
    } catch (e) {
      setError('Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  const currentPlan = limits?.plan || 'free';
  const planName = currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);
  const isFree = currentPlan === 'free';
  
  const totalListings = limits?.current_count || 0;
  const listingLimit = limits?.max_allowed || 0;
  
  let progressPct = 0;
  if (listingLimit > 0) {
    progressPct = (totalListings / listingLimit) * 100;
  }
  if (progressPct > 100) progressPct = 100;

  if (loading) {
    return (
      <View style={[styles.centerContainer, { marginVertical: 20 }]}>
        <ActivityIndicator size="small" color="#2563EB" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { marginVertical: 20 }]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#1E40AF" style={{ marginRight: 8 }} />
        <Text style={styles.infoBannerText}>
          Payments and plan upgrades are currently managed on our Web platform. Log in from your computer to change plans.
        </Text>
      </View>

      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <View>
            <Text style={styles.planLabel}>Current Plan</Text>
            <Text style={styles.planName}>{planName}</Text>
          </View>
          <View style={[styles.planBadge, isFree ? styles.badgeFree : styles.badgePro]}>
            <Ionicons name={isFree ? "leaf-outline" : "star"} size={14} color={isFree ? "#15803D" : "#B45309"} />
            <Text style={[styles.badgeText, isFree ? styles.badgeTextFree : styles.badgeTextPro]}>
              {isFree ? 'Starter' : 'Premium'}
            </Text>
          </View>
        </View>

        <View style={styles.usageSection}>
          <View style={styles.usageHeader}>
            <Text style={styles.usageLabel}>Listing Usage</Text>
            <Text style={styles.usageCount}>{totalListings} / {listingLimit === -1 ? '∞' : listingLimit}</Text>
          </View>

          {listingLimit !== -1 && (
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: progressPct >= 100 ? '#EF4444' : '#2563EB' }]} />
            </View>
          )}
          
          {!limits?.can_create && (
            <Text style={styles.limitWarningText}>
              You have reached your listing limit. Please upgrade to add more.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Plan Features</Text>
        
        <View style={styles.featureRow}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.featureText}>{listingLimit === -1 ? 'Unlimited' : listingLimit} Active Listings</Text>
        </View>
        
        <View style={styles.featureRow}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.featureText}>{pricing?.limits?.[`${currentPlan}_image_limit`] || 5} Images per listing</Text>
        </View>

        <View style={styles.featureRow}>
          <Ionicons name={isFree ? "close-circle" : "checkmark-circle"} size={20} color={isFree ? "#D1D5DB" : "#10B981"} />
          <Text style={[styles.featureText, isFree && styles.featureTextDisabled]}>Priority search placement</Text>
        </View>
        
        <View style={styles.featureRow}>
          <Ionicons name={isFree ? "close-circle" : "checkmark-circle"} size={20} color={isFree ? "#D1D5DB" : "#10B981"} />
          <Text style={[styles.featureText, isFree && styles.featureTextDisabled]}>Pro badge on profile</Text>
        </View>
      </View>

      {/* Referral / Affiliate Section */}
      <View style={[styles.referralCard, appliedCode ? styles.referralCardApplied : null]}>
        {appliedCode ? (
          <View>
            <View style={styles.referralAppliedRow}>
              <View style={styles.referralAppliedBadge}>
                <Ionicons name="pricetag" size={16} color="#15803D" />
                <Text style={styles.referralAppliedText}>Code Applied: <Text style={styles.referralCodeHighlight}>{appliedCode}</Text></Text>
              </View>
              <Pressable onPress={handleRemoveCode} style={styles.referralRemoveBtn}>
                <Text style={styles.referralRemoveText}>Remove</Text>
              </Pressable>
            </View>
            <Text style={styles.referralAppliedSub}>
              Affiliate referral attached. Your upgrade will auto-attribute to this partner.
            </Text>
          </View>
        ) : (
          <View>
            <Text style={styles.referralTitle}>Have an Affiliate / Referral Code?</Text>
            <View style={styles.referralInputRow}>
              <TextInput
                style={styles.referralTextInput}
                placeholder="e.g. KB-94X2A"
                placeholderTextColor="#9CA3AF"
                value={referralInput}
                onChangeText={(text) => {
                  setReferralInput(text.toUpperCase());
                  setReferralError('');
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Pressable style={styles.referralApplyBtn} onPress={handleApplyCode}>
                <Text style={styles.referralApplyBtnText}>Apply</Text>
              </Pressable>
            </View>
            {referralError ? <Text style={styles.referralErrorText}>{referralError}</Text> : null}
            <Text style={styles.referralHelpText}>
              Got a link or code from a partner? Type it here before upgrading.
            </Text>
          </View>
        )}
      </View>

      <Pressable 
        style={styles.ctaButton} 
        onPress={() => {
          const url = appliedCode 
            ? `https://kobrokr.com/pricing?ref=${encodeURIComponent(appliedCode)}`
            : 'https://kobrokr.com/pricing';
          Linking.openURL(url);
        }}
      >
        <Text style={styles.ctaButtonText}>Upgrade on Web Platform</Text>
        <Ionicons name="open-outline" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: Fonts.sans,
    color: '#EF4444',
    fontSize: 14,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoBannerText: {
    fontFamily: Fonts.sans,
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  planCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  planLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  planName: {
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeFree: {
    backgroundColor: '#DCFCE7',
  },
  badgePro: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextFree: {
    color: '#15803D',
  },
  badgeTextPro: {
    color: '#B45309',
  },
  usageSection: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 16,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  usageLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#D1D5DB',
  },
  usageCount: {
    fontFamily: Fonts.monoMedium,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  limitWarningText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#FCA5A5',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
  },
  cardTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
  },
  featureTextDisabled: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  ctaButton: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  ctaButtonText: {
    fontFamily: Fonts.sansBold,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  referralCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginTop: 16,
  },
  referralCardApplied: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  referralAppliedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  referralAppliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  referralAppliedText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#15803D',
  },
  referralCodeHighlight: {
    fontFamily: Fonts.monoSemiBold,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  referralRemoveBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  referralRemoveText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#EF4444',
  },
  referralAppliedSub: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#166534',
  },
  referralTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: '#374151',
    marginBottom: 10,
  },
  referralInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  referralTextInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: Fonts.mono,
    fontSize: 14,
    color: '#111827',
  },
  referralApplyBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralApplyBtnText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 14,
  },
  referralErrorText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  referralHelpText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  }
});
