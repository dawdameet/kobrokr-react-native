import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storage } from '../../lib/storage';
import { router } from 'expo-router';
import api from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function BrokerDashboard() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({ listings: null as null | number, active: null as null | number, saved: null as null | number });
  const [recentListings, setRecentListings] = useState<any[]>([]);
  const [nlQuery, setNlQuery] = useState('');

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

  const formatPrice = (p: number) => {
    if (!p) return '—';
    if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
    if (p >= 100000) return `₹${(p / 100000).toFixed(1)} L`;
    return `₹${p.toLocaleString()}`;
  };

  const handleLogout = async () => {
    await storage.remove('access_token');
    await storage.remove('refresh_token');
    await storage.remove('user');
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logoText}>kobrokr</Text>
          <Text style={styles.title}>
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll} contentContainerStyle={styles.statsContainer}>
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

          <Pressable style={styles.statCard}>
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
        </ScrollView>

        {/* Quick Actions */}
        <View style={styles.actionsGrid}>
          <Pressable style={[styles.actionButton, { backgroundColor: '#2563EB', flexDirection: 'row', gap: 6 }]} onPress={() => router.push('/(broker)/add-property')}>
            <Ionicons name="add-outline" size={16} color="#FFFFFF" />
            <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>Add Property</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', gap: 6 }]} onPress={() => router.push('/(broker)/my-listings')}>
            <Ionicons name="list-outline" size={16} color="#374151" />
            <Text style={[styles.actionButtonText, { color: '#374151' }]}>My Listings</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', gap: 6 }]} onPress={() => router.push('/search')}>
            <Ionicons name="search-outline" size={16} color="#374151" />
            <Text style={[styles.actionButtonText, { color: '#374151' }]}>Search</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', gap: 6 }]} onPress={() => router.push('/saved')}>
            <Ionicons name="heart-outline" size={16} color="#374151" />
            <Text style={[styles.actionButtonText, { color: '#374151' }]}>Saved</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', gap: 6 }]} onPress={() => router.push('/profile')}>
            <Ionicons name="person-outline" size={16} color="#374151" />
            <Text style={[styles.actionButtonText, { color: '#374151' }]}>Profile</Text>
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
              {recentListings.map((p, index) => {
                return (
                  <Pressable key={index} style={styles.propertyCard} onPress={() => router.push(`/properties/${p.id}`)}>
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

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log out</Text>
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
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2563EB',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsScroll: {
    overflow: 'visible',
    marginBottom: 24,
  },
  statsContainer: {
    gap: 12,
  },
  statCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
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
    fontSize: 12,
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    width: '47%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  recentViewAll: {
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
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  propertyLocality: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  propertyPriceContainer: {
    alignItems: 'flex-end',
  },
  propertyPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1D4ED8',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  }
});
