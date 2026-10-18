import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storage } from '../../lib/storage';
import { statsStore } from '../../lib/statsStore';
import { router } from 'expo-router';
import api from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { clearSession } from '../../lib/auth';
import { formatPrice } from '../../lib/utils';
import { Fonts } from '../../constants/theme';

export default function TenantDashboard() {
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const cachedSaved = statsStore.getStats()?.tenant?.saved;
  const [savedCount, setSavedCount] = useState<number | null>(cachedSaved ?? null);
  const [recentSaved, setRecentSaved] = useState<any[]>([]);
  const [nlQuery, setNlQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function loadData() {
      const userStr = await storage.get('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
      }
    }
    loadData();

    const unsubscribe = statsStore.subscribe((allStats) => {
      if (allStats?.tenant?.saved !== undefined) {
        setSavedCount(allStats.tenant.saved);
      }
    });

    statsStore.init().then((initial) => {
      if (initial?.tenant?.saved !== undefined) {
        setSavedCount(initial.tenant.saved);
      }
      if (initial?.tenant?.saved === undefined || statsStore.isStale()) {
        fetchData();
      } else {
        // Quietly fetch recent saved for preview
        api.get('/saved/tenant')
          .then((res) => setRecentSaved(res.data.slice(0, 3)))
          .catch(() => {});
      }
    });

    return unsubscribe;
  }, []);

  const fetchData = async () => {
    try {
      // Endpoint from web app
      const { data } = await api.get('/saved/tenant');
      statsStore.setTenantStats({ saved: data.length });
      setSavedCount(data.length);
      setRecentSaved(data.slice(0, 3));
    } catch (e) {
      console.log('Failed to fetch saved properties', e);
      if (statsStore.getStats()?.tenant?.saved === undefined) {
        setSavedCount(0);
      }
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
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.logoText, { marginBottom: 0 }]}>kobrokr</Text>
            <Pressable onPress={() => router.push('/profile')} style={{ padding: 4 }}>
              <Ionicons name="person-circle-outline" size={32} color="#111827" />
            </Pressable>
          </View>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            {t('tenantDashboard.greeting')}{firstName ? `, ${firstName}` : ''} 👋
          </Text>
          <Text style={styles.subtitle}>{t('tenantDashboard.subtitle')}</Text>
        </View>

        {/* Quick Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={nlQuery}
            onChangeText={setNlQuery}
            placeholder={t('tenantDashboard.searchPlaceholder')}
            placeholderTextColor="#9CA3AF"
          />
          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>{t('common.search')}</Text>
          </Pressable>
        </View>

        {/* Stat Cards */}
        <View style={styles.statsContainer}>
          <Pressable style={styles.statCard} onPress={() => router.push('/saved')}>
            <Text style={styles.statLabel}>{t('brokerDashboard.savedProperties')}</Text>
            {savedCount === null ? (
              <ActivityIndicator size="small" color="#9333EA" style={{ marginTop: 8 }} />
            ) : (
              <Text style={[styles.statValue, { color: '#9333EA' }]}>{savedCount}</Text>
            )}
            <View style={[styles.badge, { backgroundColor: '#F3E8FF' }]}>
              <Text style={[styles.badgeText, { color: '#9333EA' }]}>{t('brokerDashboard.view')}</Text>
            </View>
          </Pressable>

          <Pressable style={styles.statCard} onPress={() => router.push('/search')}>
            <Text style={styles.statLabel}>{t('tenantDashboard.browseProperties')}</Text>
            <Text style={[styles.statValue, { color: '#2563EB' }]}>{t('common.search')}</Text>
            <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
              <Text style={[styles.badgeText, { color: '#2563EB' }]}>{t('tenantDashboard.start')}</Text>
            </View>
          </Pressable>
        </View>

        {/* Recently Saved */}
        {recentSaved.length > 0 && (
          <View style={styles.recentContainer}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>{t('tenantDashboard.recentlySaved')}</Text>
              <Text style={styles.recentViewAll}>{t('tenantDashboard.viewAll')}</Text>
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
            <Text style={styles.emptyTitle}>{t('library.noSavedYet')}</Text>
            <Text style={styles.emptySubtitle}>{t('library.searchAndSaveSub')}</Text>
            <Pressable style={styles.emptyButton} onPress={() => router.push('/search')}>
              <Text style={styles.emptyButtonText}>{t('library.browseProperties')}</Text>
            </Pressable>
          </View>
        )}


      </ScrollView>

      {/* Floating Ball: Become a Partner */}
      <Pressable 
        style={styles.floatingPartnerBall} 
        onPress={() => router.push('/partner' as any)}
        accessibilityLabel="Become a Partner"
        accessibilityRole="button"
      >
        <Ionicons name="briefcase" size={24} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    position: 'relative',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 90,
    flexGrow: 1,
  },
  floatingPartnerBall: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99,
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
    padding: 20,
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
  },
  propertySpecs: {
    fontFamily: Fonts.sans,
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
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: Fonts.sans,
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
    fontFamily: Fonts.sansMedium,
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
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  }
});
