import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../lib/api';

export default function SubscriptionScreen() {
  const [limits, setLimits] = useState<any>(null);
  const [pricing, setPricing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

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
  
  // Calculate percentage for progress bar
  let progressPct = 0;
  if (listingLimit > 0) {
    progressPct = (totalListings / listingLimit) * 100;
  }
  if (progressPct > 100) progressPct = 100;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Subscription Status</Text>
        <View style={{ width: 32 }} />
      </View>

      {error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
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

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  planName: {
    fontSize: 28,
    fontWeight: 'bold',
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
    fontSize: 12,
    fontWeight: 'bold',
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
    fontSize: 14,
    color: '#D1D5DB',
  },
  usageCount: {
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
  },
  featureTextDisabled: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  }
});
