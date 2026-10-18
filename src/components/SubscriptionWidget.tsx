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
  const [extraUsers, setExtraUsers] = useState(0);

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

    if (planKey === 'enterprise' && extraUsers > 0) {
      params.set('users', extraUsers.toString());
    }

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

  // Pricing & Display mappings
  const isAnnual = billingCycle === 'annual';
  const periodLabel = isAnnual ? 'yr' : 'mo';

  const indDisplay = pricing?.display?.individual?.[billingCycle];
  const entDisplay = pricing?.display?.enterprise?.[billingCycle];

  // Pro Pricing (Matches screenshot: ₹499/mo [₹799 strike] or ₹5,499/yr [₹8,999 strike])
  const proPrice = indDisplay?.display_price ?? (isAnnual ? (pricing?.plans?.pro?.annual?.launch ?? 5499) : (pricing?.plans?.pro?.monthly?.launch ?? 499));
  const proOriginal = indDisplay?.strike_price ?? (isAnnual ? (pricing?.plans?.pro?.annual?.original ?? 8999) : (pricing?.plans?.pro?.monthly?.original ?? 799));
  const proBadge = indDisplay?.badge ?? '⭐ FOUNDING OFFER';
  const proSavings = indDisplay?.savings ?? (isAnnual ? 'SAVE 39%' : 'SAVE 38%');

  // Agency Pricing (Matches screenshot: ₹1,999/mo [₹3,199 strike] or ₹21,999/yr [₹34,999 strike])
  const agencyBasePrice = entDisplay?.display_price ?? (isAnnual ? (pricing?.plans?.agency?.annual?.launch ?? 21999) : (pricing?.plans?.agency?.monthly?.launch ?? 1999));
  const agencyOriginal = entDisplay?.strike_price ?? (isAnnual ? (pricing?.plans?.agency?.annual?.original ?? 34999) : (pricing?.plans?.agency?.monthly?.original ?? 3199));
  const agencyBadge = entDisplay?.badge ?? '🚀 LAUNCH OFFER';
  const agencySavings = entDisplay?.savings ?? (isAnnual ? 'SAVE 37%' : 'SAVE 38%');

  // Dynamic limits from API
  const freeListingLimit = pricing?.limits?.free_listing_limit ?? 3;
  const proListings = pricing?.limits?.individual_listing_limit ?? 30;
  const agencyIncludedUsers = pricing?.limits?.included_users ?? 4;
  const agencyListingsPerUser = pricing?.limits?.enterprise_listing_limit ?? 40;
  const agencyImagesPerProperty = pricing?.limits?.enterprise_image_limit ?? 8;
  const extraUserFee = isAnnual ? (pricing?.limits?.extra_user_annual ?? 7999) : (pricing?.limits?.extra_user_monthly ?? 699);

  const totalAgencyUsers = agencyIncludedUsers + extraUsers;
  const agencyTotalPrice = agencyBasePrice + extraUsers * extraUserFee;

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

      {/* Available Plans Section Header & Pill Switcher */}
      <View style={styles.plansSectionHeader}>
        <Text style={styles.plansSectionTitle}>Choose a Plan</Text>
        <Text style={styles.plansSectionSubtitle}>Select a plan below to proceed to checkout</Text>

        {/* Centered Pill Toggle (Matches screenshot design) */}
        <View style={styles.pillToggleWrapper}>
          <View style={styles.pillToggleContainer}>
            <Pressable
              style={[styles.pillBtn, billingCycle === 'monthly' && styles.pillBtnActive]}
              onPress={() => setBillingCycle('monthly')}
            >
              <Text style={[styles.pillBtnText, billingCycle === 'monthly' && styles.pillBtnTextActive]}>
                Monthly
              </Text>
            </Pressable>
            <Pressable
              style={[styles.pillBtn, billingCycle === 'annual' && styles.pillBtnActive]}
              onPress={() => setBillingCycle('annual')}
            >
              <Text style={[styles.pillBtnText, billingCycle === 'annual' && styles.pillBtnTextActive]}>
                Annual
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* PLAN 1: FREE */}
      <View style={[styles.planCardLight, isFree && styles.planCardActiveOutline]}>
        <Text style={styles.planTitleLight}>Free</Text>
        <Text style={styles.planSubtitleLight}>Perfect for getting started.</Text>

        <View style={styles.priceContainerLight}>
          <Text style={styles.priceSymbolLight}>₹</Text>
          <Text style={styles.priceAmountLight}>0</Text>
          <Text style={styles.pricePeriodLight}>/mo</Text>
        </View>

        <View style={styles.featuresListLight}>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#2563EB" style={styles.featureIcon} />
            <Text style={styles.featureTextLight}>Up to {freeListingLimit} active listings</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#2563EB" style={styles.featureIcon} />
            <Text style={styles.featureTextLight}>Basic search visibility</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#2563EB" style={styles.featureIcon} />
            <Text style={styles.featureTextLight}>Broker profile page</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#2563EB" style={styles.featureIcon} />
            <Text style={styles.featureTextLight}>Save properties</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="close" size={17} color="#94A3B8" style={styles.featureIcon} />
            <Text style={[styles.featureTextLight, styles.featureTextDisabled]}>Unlimited listings</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="close" size={17} color="#94A3B8" style={styles.featureIcon} />
            <Text style={[styles.featureTextLight, styles.featureTextDisabled]}>Pro badge on profile</Text>
          </View>
        </View>

        <View style={[styles.planBtnSecondary, isFree && styles.planBtnDisabled]}>
          <Text style={styles.planBtnSecondaryText}>
            {isFree ? 'Current Plan' : 'Get started'}
          </Text>
        </View>
      </View>

      {/* PLAN 2: PRO (DARK NAVY CARD - MATCHES SCREENSHOT) */}
      <Pressable
        style={({ pressed }) => [
          styles.proCardDark,
          isIndividual && styles.proCardCurrentOutline,
          pressed && !isIndividual && styles.planCardPressed,
        ]}
        onPress={() => !isIndividual && handleUpgrade('individual')}
        disabled={isIndividual}
      >
        {/* Most Popular Floating Tag */}
        <View style={styles.mostPopularTag}>
          <Text style={styles.mostPopularTagText}>MOST POPULAR</Text>
        </View>

        <Text style={styles.proTitleDark}>Pro</Text>
        <Text style={styles.proSubtitleDark}>For serious brokers.</Text>

        <View style={styles.priceRowDark}>
          {proOriginal ? (
            <Text style={styles.strikePriceDark}>₹{proOriginal.toLocaleString('en-IN')}</Text>
          ) : null}
          <Text style={styles.priceCurrencyDark}>₹</Text>
          <Text style={styles.priceAmountDark}>
            {getDiscounted(proPrice).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.pricePeriodDark}>/{periodLabel}</Text>
        </View>
        <Text style={styles.gstTextDark}>(+ GST)</Text>

        {/* Offer Badges */}
        <View style={styles.badgesRowDark}>
          <View style={styles.foundingOfferBadge}>
            <Text style={styles.foundingOfferBadgeText}>{proBadge.toUpperCase()}</Text>
          </View>
          {proSavings ? (
            <View style={styles.savingsBadgeDark}>
              <Text style={styles.savingsBadgeDarkText}>{proSavings.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>

        {appliedCode && referralDiscountPct > 0 ? (
          <View style={styles.referralDarkNote}>
            <Ionicons name="checkmark-circle" size={13} color="#34D399" />
            <Text style={styles.referralDarkNoteText}>
              {referralDiscountPct}% referral discount applied
            </Text>
          </View>
        ) : null}

        {/* Pro Features */}
        <View style={styles.featuresListDark}>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#34D399" style={styles.featureIcon} />
            <Text style={styles.featureTextDark}>Up to {proListings} active listings</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#34D399" style={styles.featureIcon} />
            <Text style={styles.featureTextDark}>Pro badge on profile</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#34D399" style={styles.featureIcon} />
            <Text style={styles.featureTextDark}>Save properties</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#34D399" style={styles.featureIcon} />
            <Text style={styles.featureTextDark}>Priority visibility</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#34D399" style={styles.featureIcon} />
            <Text style={styles.featureTextDark}>All future Pro features</Text>
          </View>
        </View>

        {/* Subscribe Button */}
        <View style={[styles.proCtaBtn, isIndividual && styles.proCtaBtnDisabled]}>
          <Text style={styles.proCtaBtnText}>
            {isIndividual ? 'Your Current Plan' : 'Subscribe to Pro'}
          </Text>
          {!isIndividual && (
            <Ionicons name="open-outline" size={16} color="#0B132B" style={{ marginLeft: 6 }} />
          )}
        </View>
      </Pressable>

      {/* PLAN 3: AGENCY (MATCHES SCREENSHOT) */}
      <Pressable
        style={({ pressed }) => [
          styles.planCardLight,
          isEnterprise && styles.planCardActiveOutline,
          pressed && !isEnterprise && styles.planCardPressed,
        ]}
        onPress={() => !isEnterprise && handleUpgrade('enterprise')}
        disabled={isEnterprise}
      >
        <Text style={styles.planTitleLight}>Agency</Text>
        <Text style={styles.planSubtitleLight}>For teams of brokers.</Text>

        <View style={styles.priceRowLight}>
          {agencyOriginal ? (
            <Text style={styles.strikePriceLight}>₹{agencyOriginal.toLocaleString('en-IN')}</Text>
          ) : null}
          <Text style={styles.priceSymbolLight}>₹</Text>
          <Text style={styles.priceAmountLight}>
            {getDiscounted(agencyBasePrice).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.pricePeriodLight}>/{periodLabel}</Text>
        </View>
        <Text style={styles.gstTextLight}>(+ GST)</Text>

        {/* Offer Badges */}
        <View style={styles.badgesRowLight}>
          <View style={styles.launchOfferBadge}>
            <Text style={styles.launchOfferBadgeText}>{agencyBadge.toUpperCase()}</Text>
          </View>
          {agencySavings ? (
            <View style={styles.savingsBadgeLight}>
              <Text style={styles.savingsBadgeLightText}>{agencySavings.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.agencyUserNote}>
          Includes {agencyIncludedUsers} users • + ₹{extraUserFee.toLocaleString('en-IN')}/{periodLabel} per additional user
        </Text>

        {/* User Calculator controls */}
        <View style={styles.userCalculatorBox}>
          <View style={styles.userCalcHeader}>
            <Text style={styles.userCalcLabel}>Additional users</Text>
            <View style={styles.counterRow}>
              <Pressable
                onPress={() => setExtraUsers(prev => Math.max(0, prev - 1))}
                style={styles.counterBtn}
              >
                <Text style={styles.counterBtnText}>−</Text>
              </Pressable>
              <Text style={styles.counterValueText}>{extraUsers}</Text>
              <Pressable
                onPress={() => setExtraUsers(prev => Math.min(20, prev + 1))}
                style={styles.counterBtn}
              >
                <Text style={styles.counterBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.totalUsersSubtext}>{totalAgencyUsers} users total</Text>
        </View>

        {/* Total Price Row */}
        <View style={styles.agencyTotalRow}>
          <Text style={styles.agencyTotalLabel}>Total</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.agencyTotalAmount}>
              ₹{getDiscounted(agencyTotalPrice).toLocaleString('en-IN')}
              <Text style={styles.agencyTotalPeriod}>/{periodLabel}</Text>
            </Text>
            <Text style={styles.gstTextLight}>(+ GST)</Text>
          </View>
        </View>

        {appliedCode && referralDiscountPct > 0 ? (
          <View style={[styles.referralDarkNote, { marginTop: 6, marginBottom: 12 }]}>
            <Ionicons name="checkmark-circle" size={13} color="#15803D" />
            <Text style={[styles.referralDarkNoteText, { color: '#15803D' }]}>
              {referralDiscountPct}% referral discount applied
            </Text>
          </View>
        ) : null}

        {/* Agency Features Checklist */}
        <View style={styles.featuresListLight}>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#2563EB" style={styles.featureIcon} />
            <Text style={styles.featureTextLight}>Up to {totalAgencyUsers} Team Members</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#2563EB" style={styles.featureIcon} />
            <Text style={styles.featureTextLight}>{agencyListingsPerUser} Listings per User</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#2563EB" style={styles.featureIcon} />
            <Text style={styles.featureTextLight}>{agencyImagesPerProperty} Images per Property</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#2563EB" style={styles.featureIcon} />
            <Text style={styles.featureTextLight}>Multiple team member logins</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#2563EB" style={styles.featureIcon} />
            <Text style={styles.featureTextLight}>Centralized listings across team</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#2563EB" style={styles.featureIcon} />
            <Text style={styles.featureTextLight}>Agency profile page</Text>
          </View>
          <View style={styles.featureItemRow}>
            <Ionicons name="checkmark" size={17} color="#2563EB" style={styles.featureIcon} />
            <Text style={styles.featureTextLight}>Priority support</Text>
          </View>
        </View>

        {/* Agency Action Button */}
        <View style={[styles.agencyCtaBtn, isEnterprise && styles.agencyCtaBtnDisabled]}>
          <Text style={styles.agencyCtaBtnText}>
            {isEnterprise ? 'Your Current Plan' : 'Subscribe to Agency'}
          </Text>
          {!isEnterprise && (
            <Ionicons name="open-outline" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
          )}
        </View>
      </Pressable>

      {/* Support note */}
      <View style={styles.supportFooter}>
        <Ionicons name="mail-outline" size={15} color="#64748B" />
        <Text style={styles.supportFooterText}>
          Need help or enterprise invoicing? Email{' '}
          <Text
            style={styles.supportFooterEmail}
            onPress={() => Linking.openURL('mailto:support@kobrokr.com?subject=KoBrokr%20Subscription%20Inquiry')}
          >
            support@kobrokr.com
          </Text>
        </Text>
      </View>
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
    alignItems: 'center',
    marginBottom: 16,
  },
  planLabel: {
    fontFamily: Fonts.sans,
    color: '#9CA3AF',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  planName: {
    fontFamily: Fonts.display,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeFree: {
    backgroundColor: '#DCFCE7',
  },
  badgePro: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  badgeTextFree: {
    color: '#15803D',
  },
  badgeTextPro: {
    color: '#B45309',
  },
  usageSection: {
    marginTop: 8,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  usageLabel: {
    fontFamily: Fonts.sans,
    color: '#9CA3AF',
    fontSize: 14,
  },
  usageCount: {
    fontFamily: Fonts.sansMedium,
    color: '#FFFFFF',
    fontSize: 14,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referralAppliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  referralAppliedText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#15803D',
  },
  referralCodeHighlight: {
    fontFamily: Fonts.sansBold,
    fontWeight: '700',
  },
  referralRemoveBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  referralRemoveText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#EF4444',
  },
  referralAppliedSub: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#166534',
    marginTop: 4,
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
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
    color: '#111827',
    fontFamily: Fonts.mono || 'monospace',
  },
  referralApplyBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
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
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  referralHelpText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
  plansSectionHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  plansSectionTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
    textAlign: 'center',
  },
  plansSectionSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    textAlign: 'center',
  },
  pillToggleWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 30,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pillBtn: {
    paddingVertical: 8,
    paddingHorizontal: 22,
    borderRadius: 24,
  },
  pillBtnActive: {
    backgroundColor: '#2563EB',
  },
  pillBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#64748B',
  },
  pillBtnTextActive: {
    fontFamily: Fonts.sansBold,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  planCardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },

  /* Light Card (Free & Agency) */
  planCardLight: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 22,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  planCardActiveOutline: {
    borderColor: '#93C5FD',
  },
  planTitleLight: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  planSubtitleLight: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 16,
  },
  priceContainerLight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  priceRowLight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  strikePriceLight: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  priceSymbolLight: {
    fontFamily: Fonts.sansBold,
    fontSize: 20,
    color: '#0F172A',
    fontWeight: '700',
    marginRight: 2,
  },
  priceAmountLight: {
    fontFamily: Fonts.display,
    fontSize: 36,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  pricePeriodLight: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#64748B',
    marginLeft: 4,
  },
  gstTextLight: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
  },
  badgesRowLight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  launchOfferBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  launchOfferBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    color: '#15803D',
    fontWeight: '700',
  },
  savingsBadgeLight: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  savingsBadgeLightText: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
  },
  agencyUserNote: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 17,
  },
  userCalculatorBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  userCalcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userCalcLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#334155',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 18,
  },
  counterValueText: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'center',
  },
  totalUsersSubtext: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  agencyTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 12,
  },
  agencyTotalLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#0F172A',
  },
  agencyTotalAmount: {
    fontFamily: Fonts.display,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  agencyTotalPeriod: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#64748B',
  },
  featuresListLight: {
    gap: 10,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 16,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIcon: {
    width: 18,
  },
  featureTextLight: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#334155',
  },
  featureTextDisabled: {
    color: '#94A3B8',
  },
  planBtnSecondary: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBtnDisabled: {
    opacity: 0.6,
  },
  planBtnSecondaryText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
  },
  agencyCtaBtn: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agencyCtaBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  agencyCtaBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Pro Dark Card (Matches screenshot dark navy style) */
  proCardDark: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 24,
    paddingTop: 28,
    marginBottom: 20,
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  proCardCurrentOutline: {
    borderColor: '#34D399',
  },
  mostPopularTag: {
    position: 'absolute',
    top: -12,
    left: 20,
    backgroundColor: '#34D399',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  mostPopularTagText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#064E3B',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  proTitleDark: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  proSubtitleDark: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 16,
  },
  priceRowDark: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  strikePriceDark: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: '#64748B',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  priceCurrencyDark: {
    fontFamily: Fonts.sansBold,
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
    marginRight: 2,
  },
  priceAmountDark: {
    fontFamily: Fonts.display,
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  pricePeriodDark: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 4,
  },
  gstTextDark: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  badgesRowDark: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  foundingOfferBadge: {
    backgroundColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  foundingOfferBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#064E3B',
    fontWeight: '800',
  },
  savingsBadgeDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  savingsBadgeDarkText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  referralDarkNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  referralDarkNoteText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#34D399',
  },
  featuresListDark: {
    gap: 10,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    marginBottom: 16,
  },
  featureTextDark: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#FFFFFF',
  },
  proCtaBtn: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proCtaBtnDisabled: {
    backgroundColor: '#475569',
  },
  proCtaBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#0B132B',
    fontWeight: '700',
  },
  supportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  supportFooterText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  supportFooterEmail: {
    fontFamily: Fonts.sansSemiBold,
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
});
