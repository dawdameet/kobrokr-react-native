import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storage } from '../../lib/storage';
import { router } from 'expo-router';
import api from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { clearSession } from '../../lib/auth';
import { formatPrice } from '../../lib/utils';
import { Fonts } from '../../constants/theme';

export default function BrokerDashboard() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({ listings: null as null | number, active: null as null | number, saved: null as null | number });
  const [recentListings, setRecentListings] = useState<any[]>([]);
  const [nlQuery, setNlQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function loadData() {
      const userStr = await storage.get('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
      }
      fetchData();
    }
    loadData();
  }, []);

  const fetchData = async () => {
    try {
      const [listingsRes, savedRes] = await Promise.all([
        api.get('/properties/my'),
        api.get('/saved'),
      ]);
      const listings = listingsRes.data;
      setStats({
        listings: listings.length,
        active: listings.filter((p: any) => p.status === 'active').length,
        saved: savedRes.data.length,
      });
      setRecentListings(listings.slice(0, 3));
    } catch (e) {
      console.log('Failed to fetch broker stats', e);
      setStats({ listings: 0, active: 0, saved: 0 });
    }
  };

  const handleSearch = () => {
    router.push({ pathname: '/search', params: { q: nlQuery.trim() } });
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchData().finally(() => setRefreshing(false));
  }, []);

  const firstName = user?.full_name?.trim()
    ? user.full_name.trim().split(/\s+/)[0]
    : (user?.first_name || (user?.email ? user.email.split('@')[0] : ''));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.logoText, { marginBottom: 0 }]}>kobrokr</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable 
                style={styles.partnerBtnSmall} 
                onPress={() => {}}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="briefcase-outline" size={13} color="#2563EB" />
                <Text style={styles.partnerBtnSmallText}>BECOME A PARTNER</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/profile')} style={{ padding: 4 }}>
                <Ionicons name="person-circle-outline" size={32} color="#111827" />
              </Pressable>
            </View>
          </View>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            Welcome back{firstName ? `, ${firstName}` : ''} 👋
          </Text>
          <Text style={styles.subtitle}>Here's what's happening on kobrokr</Text>
        </View>

        {/* Quick Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={nlQuery}
            onChangeText={setNlQuery}
            placeholder='Quick search — try "2 bhk in Powai"'
            placeholderTextColor="#9CA3AF"
          />
          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>

        {/* Stat Cards */}
        <View style={styles.statsContainer}>
          <Pressable style={styles.statCard} onPress={() => router.push('/(broker)/my-listings')}>
            <Text style={styles.statLabel}>Total Listings</Text>
            {stats.listings === null ? (
              <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 8 }} />
            ) : (
              <Text style={[styles.statValue, { color: '#2563EB' }]}>{stats.listings}</Text>
            )}
            <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
              <Text style={[styles.badgeText, { color: '#2563EB' }]}>View →</Text>
            </View>
          </Pressable>

          <Pressable style={styles.statCard} onPress={() => router.push('/(broker)/my-listings')}>
            <Text style={styles.statLabel}>Active Listings</Text>
            {stats.active === null ? (
              <ActivityIndicator size="small" color="#16A34A" style={{ marginTop: 8 }} />
            ) : (
              <Text style={[styles.statValue, { color: '#16A34A' }]}>{stats.active}</Text>
            )}
            <View style={[styles.badge, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.badgeText, { color: '#16A34A' }]}>View →</Text>
            </View>
          </Pressable>

          <Pressable style={styles.statCard} onPress={() => router.push('/saved')}>
            <Text style={styles.statLabel}>Saved Properties</Text>
            {stats.saved === null ? (
              <ActivityIndicator size="small" color="#9333EA" style={{ marginTop: 8 }} />
            ) : (
              <Text style={[styles.statValue, { color: '#9333EA' }]}>{stats.saved}</Text>
            )}
            <View style={[styles.badge, { backgroundColor: '#F3E8FF' }]}>
              <Text style={[styles.badgeText, { color: '#9333EA' }]}>View →</Text>
            </View>
          </Pressable>
        </View>

        {/* Recent Listings */}
        {recentListings.length > 0 && (
          <View style={styles.recentContainer}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Recent Listings</Text>
              <Text style={styles.recentViewAll}>View all →</Text>
            </View>
            <View style={styles.recentList}>
              {recentListings.map((p) => {
                const coverImg = p.property_images?.find((img: any) => img.is_cover)?.url || p.property_images?.[0]?.url;
                return (
                  <Pressable key={p.id} style={styles.propertyCard} onPress={() => router.push(`/properties/${p.id}`)}>
                    <View style={styles.propertyDetails}>
                      <Text style={styles.propertyTitle} numberOfLines={1}>{p.title}</Text>
                      <Text style={styles.propertyLocality}>{p.locality}, {p.city}</Text>
                    </View>
                    <View style={styles.propertyPriceContainer}>
                      <Text style={styles.propertyPrice}>{formatPrice(p.price)}</Text>
                      <View style={[
                        styles.statusBadge, 
                        p.status === 'active' ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#F3F4F6' }
                      ]}>
                        <Text style={[
                          styles.statusBadgeText,
                          p.status === 'active' ? { color: '#15803D' } : { color: '#6B7280' }
                        ]}>{p.status}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    padding: 24,
    flexGrow: 1,
  },
  header: {
    marginBottom: 24,
  },
  logoText: {
    fontFamily: Fonts.display,
    fontSize: 24,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  partnerBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  partnerBtnSmallText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 0.3,
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#6B7280',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.sans,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  searchButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  searchButtonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  statLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#6B7280',
  },
  statValue: {
    fontFamily: Fonts.monoMedium,
    fontSize: 28,
    fontWeight: '600',
    marginTop: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    marginTop: 12,
  },
  badgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    fontWeight: '600',
  },
  recentContainer: {
    marginBottom: 24,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  recentViewAll: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#2563EB',
  },
  recentList: {
    gap: 8,
  },
  propertyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
  },
  propertyDetails: {
    flex: 1,
    marginRight: 16,
  },
  propertyTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  propertyLocality: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#9CA3AF',
  },
  propertyPriceContainer: {
    alignItems: 'flex-end',
  },
  propertyPrice: {
    fontFamily: Fonts.monoMedium,
    fontSize: 14,
    fontWeight: '600',
    color: '#1D4ED8',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  statusBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  logoutButton: {
    marginTop: 12,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  }
});
