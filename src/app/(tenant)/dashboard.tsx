import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storage } from '../../lib/storage';
import { router } from 'expo-router';
import api from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { clearSession } from '../../lib/auth';
import { formatPrice } from '../../lib/utils';

export default function TenantDashboard() {
  const [user, setUser] = useState<any>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [recentSaved, setRecentSaved] = useState<any[]>([]);
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
      // Endpoint from web app
      const { data } = await api.get('/saved/tenant');
      setSavedCount(data.length);
      setRecentSaved(data.slice(0, 3));
    } catch (e) {
      console.log('Failed to fetch saved properties', e);
      setSavedCount(0);
    }
  };

  const handleSearch = () => {
    router.push({ pathname: '/search', params: { q: nlQuery.trim() } });
  };

  const handleLogout = async () => {
    await clearSession();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logoText}>kobrokr</Text>
          <Text style={styles.title}>
            Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''} 👋
          </Text>
          <Text style={styles.subtitle}>Find your perfect property on kobrokr</Text>
        </View>

        {/* Quick Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={nlQuery}
            onChangeText={setNlQuery}
            placeholder='Search "2 bhk in Powai"'
            placeholderTextColor="#9CA3AF"
          />
          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>

        {/* Stat Cards */}
        <View style={styles.statsContainer}>
          <Pressable style={styles.statCard} onPress={() => router.push('/saved')}>
            <Text style={styles.statLabel}>Saved Properties</Text>
            {savedCount === null ? (
              <ActivityIndicator size="small" color="#9333EA" style={{ marginTop: 8 }} />
            ) : (
              <Text style={[styles.statValue, { color: '#9333EA' }]}>{savedCount}</Text>
            )}
            <View style={[styles.badge, { backgroundColor: '#F3E8FF' }]}>
              <Text style={[styles.badgeText, { color: '#9333EA' }]}>View →</Text>
            </View>
          </Pressable>

          <Pressable style={styles.statCard} onPress={() => router.push('/search')}>
            <Text style={styles.statLabel}>Browse Properties</Text>
            <Text style={[styles.statValue, { color: '#2563EB' }]}>Search</Text>
            <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
              <Text style={[styles.badgeText, { color: '#2563EB' }]}>Start →</Text>
            </View>
          </Pressable>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Pressable style={styles.actionButton} onPress={() => router.push('/search')}>
            <Ionicons name="search-outline" size={24} color="#2563EB" />
            <Text style={styles.actionButtonText}>Search</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => router.push('/saved')}>
            <Ionicons name="heart-outline" size={24} color="#2563EB" />
            <Text style={styles.actionButtonText}>Saved</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => router.push('/profile')}>
            <Ionicons name="person-outline" size={24} color="#2563EB" />
            <Text style={styles.actionButtonText}>Profile</Text>
          </Pressable>
        </View>

        {/* Recently Saved */}
        {recentSaved.length > 0 && (
          <View style={styles.recentContainer}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Recently Saved</Text>
              <Text style={styles.recentViewAll}>View all →</Text>
            </View>
            <View style={styles.recentList}>
              {recentSaved.map((s, index) => {
                const p = s.properties;
                if (!p) return null;
                return (
                  <Pressable key={index} style={styles.propertyCard} onPress={() => router.push(`/properties/${p.id}`)}>
                    <View style={styles.propertyDetails}>
                      <Text style={styles.propertyTitle} numberOfLines={1}>{p.title}</Text>
                      <Text style={styles.propertyLocality}>{p.locality}, {p.city}</Text>
                    </View>
                    <View style={styles.propertyPriceContainer}>
                      <Text style={styles.propertyPrice}>{formatPrice(p.price)}</Text>
                      {p.bhk ? (
                        <Text style={styles.propertySpecs}>{p.bhk} BHK · {p.area} sq ft</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Empty State */}
        {savedCount === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No saved properties yet</Text>
            <Text style={styles.emptySubtitle}>Search for properties and save the ones you like.</Text>
            <Pressable style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Browse properties</Text>
            </Pressable>
          </View>
        )}

        {/* Spacer to push logout button to the absolute bottom */}
        <View style={{ flex: 1 }} />

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
    flexGrow: 1,
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
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
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
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
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
  },
  propertySpecs: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 48,
    color: '#D1D5DB',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 24,
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
