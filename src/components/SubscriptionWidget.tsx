import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { storage } from '../lib/storage';
import { Fonts } from '../constants/theme';

export default function SubscriptionWidget() {
  const { t } = useTranslation();
  const [limits, setLimits] = useState<any>(null);
  const [pricing, setPricing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [referralInput, setReferralInput] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [referralError, setReferralError] = useState('');
  const [referralApplying, setReferralApplying] = useState(false);
  const [referralDiscountPct, setReferralDiscountPct] = useState(0);

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
        setReferralDiscountPct(10);
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
    setReferralApplying(true);
    try {
      const res = await api.get(`/affiliate/validate?code=${encodeURIComponent(code)}`);
      if (res.data && res.data.valid) {
        setAppliedCode(code);
        setReferralDiscountPct(res.data.discount_percentage || 10);
        await storage.set('applied_referral_code', code);
      } else {
        setReferralError('Invalid or inactive referral code');
      }
    } catch (e: any) {
      setReferralError(e?.response?.data?.message || 'Invalid referral code');
    } finally {
      setReferralApplying(false);
    }
  };

  const handleRemoveCode = async () => {
    setAppliedCode('');
    setReferralInput('');
    setReferralError('');
    setReferralDiscountPct(0);
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

  const handleUpgrade = async (planKey: 'individual' | 'enterprise') => {
    const baseUrl = process.env.EXPO_PUBLIC_WEB_URL || 'https://www.kobrokr.com';
    const token = await storage.get('access_token');
    const refreshToken = await storage.get('refresh_token');

    const params = new URLSearchParams({
      plan: planKey,
      cycle: billingCycle,
      from: 'mobile',
    });

    if (token) params.set('token', token);
    if (refreshToken) params.set('refresh_token', refreshToken);
    if (appliedCode) params.set('ref', appliedCode);

    const checkoutUrl = `${baseUrl}/payment?${params.toString()}`;
    Linking.openURL(checkoutUrl);
  };

  const currentPlan = limits?.plan || 'free';
  const planName = currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);
  const isFree = currentPlan === 'free';
  const isIndividual = currentPlan === 'individual' || currentPlan === 'pro';
  const isEnterprise = currentPlan === 'enterprise' || currentPlan === 'agency';

  const totalListings = limits?.current_count || 0;
  const listingLimit = limits?.max_allowed || 0;

  let progressPct = 0;
  if (listingLimit > 0) {
    progressPct = (totalListings / listingLimit) * 100;
  }
  if (progressPct > 100) progressPct = 100;

  // Pricing values
  const proMonthly = pricing?.plans?.pro?.monthly?.launch ?? 299;
  const proMonthlyOriginal = pricing?.plans?.pro?.monthly?.original ?? 499;
  const proAnnual = pricing?.plans?.pro?.annual?.launch ?? 2999;
  const proAnnualOriginal = pricing?.plans?.pro?.annual?.original ?? 4999;

  const agencyMonthly = pricing?.plans?.agency?.monthly?.launch ?? 1099;
  const agencyMonthlyOriginal = pricing?.plans?.agency?.monthly?.original ?? 1999;
  const agencyAnnual = pricing?.plans?.agency?.annual?.launch ?? 10999;
  const agencyAnnualOriginal = pricing?.plans?.agency?.annual?.original ?? 19999;

  // Dynamic limits
  const proListings = pricing?.limits?.individual_listing_limit ?? 100;
  const proImages = pricing?.limits?.individual_image_limit ?? 10;
  const agencyListings = pricing?.limits?.enterprise_listing_limit === -1 || !pricing?.limits?.enterprise_listing_limit ? 'Unlimited' : pricing?.limits?.enterprise_listing_limit;
  const agencyImages = pricing?.limits?.enterprise_image_limit ?? 25;
  const agencyTeamMembers = pricing?.limits?.included_users ?? 5;

  const getDiscounted = (price: number) => {
    if (referralDiscountPct > 0) {
      return Math.round(price * (1 - referralDiscountPct / 100));
    }
    return price;
  };

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
      {/* Current Plan Summary Card */}
      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <View>
            <Text style={styles.planLabel}>{t('subscription.currentPlan')}</Text>
            <Text style={styles.planName}>{planName}</Text>
          </View>
          <View style={[styles.planBadge, isFree ? styles.badgeFree : styles.badgePro]}>
            <Ionicons name={isFree ? "leaf-outline" : "star"} size={14} color={isFree ? "#15803D" : "#B45309"} />
            <Text style={[styles.badgeText, isFree ? styles.badgeTextFree : styles.badgeTextPro]}>
              {isFree ? t('subscription.starter') : t('subscription.premium')}
            </Text>
          </View>
        </View>

        <View style={styles.usageSection}>
          <View style={styles.usageHeader}>
            <Text style={styles.usageLabel}>{t('subscription.listingUsage')}</Text>
            <Text style={styles.usageCount}>{totalListings} / {listingLimit === -1 ? '∞' : listingLimit}</Text>
          </View>

          {listingLimit !== -1 && (
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: progressPct >= 100 ? '#EF4444' : '#2563EB' }]} />
            </View>
          )}

          {!limits?.can_create && (
            <Text style={styles.limitWarningText}>
              {t('subscription.limitWarning')}
            </Text>
          )}
        </View>
      </View>

      {/* Partner Referral Section */}
      <View style={[styles.referralCard, appliedCode ? styles.referralCardApplied : null]}>
        {appliedCode ? (
          <View>
            <View style={styles.referralAppliedRow}>
              <View style={styles.referralAppliedBadge}>
                <Ionicons name="pricetag" size={16} color="#15803D" />
                <Text style={styles.referralAppliedText}>
                  Code Applied: <Text style={styles.referralCodeHighlight}>{appliedCode}</Text>
                  {referralDiscountPct > 0 ? ` (${referralDiscountPct}% OFF)` : ''}
                </Text>
              </View>
              <Pressable onPress={handleRemoveCode} style={styles.referralRemoveBtn}>
                <Text style={styles.referralRemoveText}>Remove</Text>
              </Pressable>
            </View>
            <Text style={styles.referralAppliedSub}>
              Partner discount attached. Prices below reflect your {referralDiscountPct}% savings.
            </Text>
          </View>
        ) : (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="pricetag-outline" size={16} color="#2563EB" />
              <Text style={styles.referralTitle}>Have a Referral Code?</Text>
              <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontFamily: Fonts.sansBold, fontSize: 10, color: '#15803D' }}>10% OFF</Text>
              </View>
            </View>
            <View style={styles.referralInputRow}>
              <TextInput
                style={styles.referralTextInput}
                placeholder="Enter referral code (e.g. KB-94X2A)"
                placeholderTextColor="#9CA3AF"
                value={referralInput}
                onChangeText={(text) => {
                  setReferralInput(text.toUpperCase());
                  setReferralError('');
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Pressable
                style={[styles.referralApplyBtn, (!referralInput.trim() || referralApplying) && { opacity: 0.5 }]}
                onPress={handleApplyCode}
                disabled={!referralInput.trim() || referralApplying}
              >
                {referralApplying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.referralApplyBtnText}>Apply</Text>
                )}
              </Pressable>
            </View>
            {referralError ? <Text style={styles.referralErrorText}>{referralError}</Text> : null}
            <Text style={styles.referralHelpText}>
              Enter a partner code to unlock an instant 10% discount on any plan.
            </Text>
          </View>
        )}
      </View>

      {/* Available Plans Section */}
      <View style={styles.plansSectionHeader}>
        <Text style={styles.plansSectionTitle}>Choose a Plan</Text>
        <Text style={styles.plansSectionSubtitle}>Select a plan below to upgrade and proceed on web</Text>

        {/* Monthly / Annual Cycle Toggle */}
        <View style={styles.cycleToggleContainer}>
          <Pressable
            style={[styles.cycleBtn, billingCycle === 'monthly' && styles.cycleBtnActive]}
            onPress={() => setBillingCycle('monthly')}
          >
            <Text style={[styles.cycleBtnText, billingCycle === 'monthly' && styles.cycleBtnTextActive]}>
              Monthly
            </Text>
          </Pressable>
          <Pressable
            style={[styles.cycleBtn, billingCycle === 'annual' && styles.cycleBtnActive]}
            onPress={() => setBillingCycle('annual')}
          >
            <Text style={[styles.cycleBtnText, billingCycle === 'annual' && styles.cycleBtnTextActive]}>
              Annual
            </Text>
            <View style={styles.savingsPill}>
              <Text style={styles.savingsPillText}>Save 20%</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Plan Card 1: Pro Broker */}
      <Pressable
        style={({ pressed }) => [
          styles.planChoiceCard,
          styles.planChoiceCardPro,
          isIndividual && styles.planChoiceCardCurrent,
          pressed && !isIndividual && styles.planChoiceCardPressed,
        ]}
        onPress={() => !isIndividual && handleUpgrade('individual')}
        disabled={isIndividual}
      >
        <View style={styles.planCardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.planIconWrapperPro}>
              <Ionicons name="star" size={18} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.planChoiceTitle}>Pro Broker</Text>
              <Text style={styles.planChoiceSubtitle}>For independent real estate brokers</Text>
            </View>
          </View>

          {isIndividual ? (
            <View style={styles.currentPlanBadge}>
              <Text style={styles.currentPlanBadgeText}>Active Plan</Text>
            </View>
          ) : (
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>POPULAR</Text>
            </View>
          )}
        </View>

        {/* Price Row */}
        <View style={styles.pricingRow}>
          <Text style={styles.priceCurrency}>₹</Text>
          <Text style={styles.priceAmount}>
            {billingCycle === 'monthly'
              ? getDiscounted(proMonthly).toLocaleString('en-IN')
              : getDiscounted(proAnnual).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.priceCycle}>
            {billingCycle === 'monthly' ? '/ month' : '/ year'}
          </Text>

          <Text style={styles.priceOriginal}>
            ₹{billingCycle === 'monthly' ? proMonthlyOriginal : proAnnualOriginal}
          </Text>
        </View>

        {appliedCode && referralDiscountPct > 0 ? (
          <View style={styles.codeAppliedNote}>
            <Ionicons name="checkmark-circle" size={14} color="#15803D" />
            <Text style={styles.codeAppliedNoteText}>
              {referralDiscountPct}% referral discount applied
            </Text>
          </View>
        ) : null}

        {/* Features Checklist */}
        <View style={styles.planFeaturesList}>
          <View style={styles.planFeatureItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.planFeatureItemText}>{proListings} Active Listings</Text>
          </View>
          <View style={styles.planFeatureItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.planFeatureItemText}>{proImages} HD Photos per listing</Text>
          </View>
          <View style={styles.planFeatureItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.planFeatureItemText}>Priority placement in search</Text>
          </View>
          <View style={styles.planFeatureItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.planFeatureItemText}>Verified Pro Badge on Profile</Text>
          </View>
          <View style={styles.planFeatureItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.planFeatureItemText}>Unlimited Client Collections</Text>
          </View>
        </View>

        {/* Action Button */}
        <View
          style={[styles.selectPlanBtn, isIndividual && styles.selectPlanBtnDisabled]}
        >
          <Text style={styles.selectPlanBtnText}>
            {isIndividual ? 'Your Current Plan' : 'Choose Pro Plan'}
          </Text>
          {!isIndividual && (
            <Ionicons name="open-outline" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
          )}
        </View>
      </Pressable>

      {/* Plan Card 2: Agency / Enterprise */}
      <Pressable
        style={({ pressed }) => [
          styles.planChoiceCard,
          styles.planChoiceCardAgency,
          isEnterprise && styles.planChoiceCardCurrent,
          pressed && !isEnterprise && styles.planChoiceCardPressed,
        ]}
        onPress={() => !isEnterprise && handleUpgrade('enterprise')}
        disabled={isEnterprise}
      >
        <View style={styles.planCardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.planIconWrapperAgency}>
              <Ionicons name="business" size={18} color="#7E22CE" />
            </View>
            <View>
              <Text style={styles.planChoiceTitle}>Agency / Enterprise</Text>
              <Text style={styles.planChoiceSubtitle}>For agencies and growing teams</Text>
            </View>
          </View>

          {isEnterprise ? (
            <View style={styles.currentPlanBadge}>
              <Text style={styles.currentPlanBadgeText}>Active Plan</Text>
            </View>
          ) : (
            <View style={styles.teamsBadge}>
              <Text style={styles.teamsBadgeText}>FOR TEAMS</Text>
            </View>
          )}
        </View>

        {/* Price Row */}
        <View style={styles.pricingRow}>
          <Text style={styles.priceCurrency}>₹</Text>
          <Text style={styles.priceAmount}>
            {billingCycle === 'monthly'
              ? getDiscounted(agencyMonthly).toLocaleString('en-IN')
              : getDiscounted(agencyAnnual).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.priceCycle}>
            {billingCycle === 'monthly' ? '/ month' : '/ year'}
          </Text>

          <Text style={styles.priceOriginal}>
            ₹{billingCycle === 'monthly' ? agencyMonthlyOriginal : agencyAnnualOriginal}
          </Text>
        </View>

        {appliedCode && referralDiscountPct > 0 ? (
          <View style={styles.codeAppliedNote}>
            <Ionicons name="checkmark-circle" size={14} color="#15803D" />
            <Text style={styles.codeAppliedNoteText}>
              {referralDiscountPct}% referral discount applied
            </Text>
          </View>
        ) : null}

        {/* Features Checklist */}
        <View style={styles.planFeaturesList}>
          <View style={styles.planFeatureItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.planFeatureItemText}>
              {agencyListings === -1 || agencyListings === 'Unlimited' ? 'Unlimited Active Listings' : `${agencyListings} Active Listings`}
            </Text>
          </View>
          <View style={styles.planFeatureItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.planFeatureItemText}>{agencyImages} HD Photos per listing</Text>
          </View>
          <View style={styles.planFeatureItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.planFeatureItemText}>{agencyTeamMembers} Team Member accounts included</Text>
          </View>
          <View style={styles.planFeatureItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.planFeatureItemText}>Agency branding & team management</Text>
          </View>
          <View style={styles.planFeatureItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.planFeatureItemText}>Top search placement & direct WhatsApp leads</Text>
          </View>
        </View>

        {/* Action Button */}
        <View
          style={[styles.selectPlanBtn, styles.selectPlanBtnAgency, isEnterprise && styles.selectPlanBtnDisabled]}
        >
          <Text style={styles.selectPlanBtnText}>
            {isEnterprise ? 'Your Current Plan' : 'Choose Agency Plan'}
          </Text>
          {!isEnterprise && (
            <Ionicons name="open-outline" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
          )}
        </View>
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
  referralCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 20,
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
  },
  referralInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
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
  },
  plansSectionHeader: {
    marginBottom: 16,
  },
  plansSectionTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  plansSectionSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  cycleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  cycleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    gap: 6,
  },
  cycleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cycleBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#64748B',
  },
  cycleBtnTextActive: {
    fontFamily: Fonts.sansBold,
    color: '#0F172A',
    fontWeight: '700',
  },
  savingsPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  savingsPillText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#15803D',
    fontWeight: '700',
  },
  planChoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  planChoiceCardPro: {
    borderColor: '#3B82F6',
  },
  planChoiceCardAgency: {
    borderColor: '#A855F7',
  },
  planChoiceCardCurrent: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  planChoiceCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  planCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planIconWrapperPro: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planIconWrapperAgency: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planChoiceTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  planChoiceSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  popularBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  popularBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#2563EB',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  teamsBadge: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  teamsBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#7E22CE',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  currentPlanBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  currentPlanBadgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: '#64748B',
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  priceCurrency: {
    fontFamily: Fonts.sansBold,
    fontSize: 18,
    color: '#0F172A',
    fontWeight: '700',
    marginRight: 2,
  },
  priceAmount: {
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  priceCycle: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#64748B',
    marginLeft: 4,
    marginRight: 8,
  },
  priceOriginal: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  codeAppliedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  codeAppliedNoteText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#15803D',
  },
  planFeaturesList: {
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 16,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planFeatureItemText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#334155',
  },
  selectPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 13,
    borderRadius: 12,
  },
  selectPlanBtnAgency: {
    backgroundColor: '#7E22CE',
  },
  selectPlanBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  selectPlanBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
