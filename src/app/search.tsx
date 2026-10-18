import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator, Modal, ScrollView, Platform, Alert, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { setPropertyPreview } from '../lib/propertyCache';
import { searchBridgeCache } from '../lib/searchBridgeCache';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../lib/api';
import { storage } from '../lib/storage';
import { clearSession } from '../lib/auth';
import { formatPrice, safeGoBack } from '../lib/utils';
import { Fonts } from '../constants/theme';
import ShareModal from '../components/ShareModal';
import CollectionModal from '../components/CollectionModal';

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const TYPES = ['apartment', 'house', 'villa', 'plot', 'office', 'shop', 'warehouse', 'other'];
const LISTING_TYPES = [{ value: '', label: 'Any' }, { value: 'sale', label: 'Buy' }, { value: 'rent', label: 'Rent' }];
const PREDEFINED_AMENITIES = [
  'Parking', 'Gym', 'Swimming Pool', 'Security', 'Club House',
  'Power Backup', 'Lift', 'Park', 'Vastu Compliant', 'Internet/Wi-Fi'
];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_low', label: 'Price: Low → High' },
  { value: 'price_high', label: 'Price: High → Low' },
  { value: 'area', label: 'Largest Area' },
];

interface PropertyCardProps {
  property: any;
  isSelected: boolean;
  isBroker: boolean;
  onSelect: (id: string | number) => void;
  onPress: (property: any) => void;
}

const PropertyCard = React.memo(function PropertyCard({
  property: p,
  isSelected,
  isBroker,
  onSelect,
  onPress,
}: PropertyCardProps) {
  const cover = p.property_images?.find((i: any) => i.is_cover)?.url || p.property_images?.[0]?.url;

  return (
    <Pressable 
      style={styles.card} 
      onPress={() => onPress(p)}
    >
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={styles.cardImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Ionicons name="image-outline" size={32} color="#D1D5DB" />
        </View>
      )}
      
      {p.is_dummy && (
        <View style={styles.dummyBadge}>
          <Text style={styles.dummyBadgeText}>DUMMY LISTING</Text>
        </View>
      )}

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{p.title}</Text>
        <Text style={styles.cardLocation}>{p.locality}, {p.city}</Text>

        <View style={styles.cardPriceRow}>
          <Text style={styles.cardPrice}>{formatPrice(p.price)}</Text>
          <Text style={styles.cardArea}>· {p.area} sq ft</Text>
        </View>

        <View style={styles.tagsContainer}>
          <Text style={styles.tag}>{p.type}</Text>
          {p.listing_type && (
            <Text style={styles.tag}>{p.listing_type === 'rent' ? 'Rent' : 'Sale'}</Text>
          )}
          {!!p.bhk && <Text style={styles.tag}>{p.bhk} BHK</Text>}
        </View>

        {isBroker && (
          <Pressable
            style={[
              styles.selectCardBtn,
              isSelected && styles.selectCardBtnActive,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onSelect(p.id);
            }}
          >
            <Ionicons
              name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
              size={16}
              color={isSelected ? '#2563EB' : '#64748B'}
            />
            <Text
              style={[
                styles.selectCardBtnText,
                isSelected && styles.selectCardBtnTextActive,
              ]}
            >
              {isSelected ? 'Selected for Client' : 'Select for Client'}
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});

export default function SearchScreen() {
  const searchParams = useLocalSearchParams<{ q?: string }>();
  const initialQ = searchParams.q || '';
  const [nlQuery, setNlQuery] = useState(initialQ);
  const [filters, setFilters] = useState<any>({
    city: '', locality: '', type: '', bhk: '', price_min: '', price_max: '', listing_type: '', area_min: '', amenities: []
  });
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  const queryKey = useMemo(() => {
    return JSON.stringify({ q: nlQuery.trim(), filters, sort });
  }, [nlQuery, filters, sort]);

  const bridge = useMemo(() => searchBridgeCache.getBridge(queryKey), [queryKey]);
  
  const [results, setResults] = useState<any[]>(() => bridge?.windowSlice || []);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(() => bridge?.totalCount || 0);
  const [searched, setSearched] = useState<boolean>(() => !!bridge);
  const [isBridging, setIsBridging] = useState<boolean>(() => !!bridge);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const scrollOffsetRef = useRef(0);

  // Restore scroll offset from bridge cache immediately
  useEffect(() => {
    if (bridge && typeof bridge.scrollOffset === 'number' && bridge.scrollOffset > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: bridge.scrollOffset!, animated: false });
      }, 50);
    }
  }, [bridge]);

  // Fetch results
  const runSearch = useCallback(async (targetPage = 1, append = false) => {
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      if (!bridge && results.length === 0) setSearched(false);
    }

    try {
      const params: any = { page: targetPage, limit: 12, sort };
      if (nlQuery.trim()) params.q = nlQuery.trim();
      
      Object.entries(filters).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          if (v.length > 0) params[k] = v.join(',');
        } else if (v !== '' && v != null) {
          params[k] = v;
        }
      });

      const { data } = await api.get('/search', { params });
      
      setResults(prev => append ? [...prev, ...data.results] : data.results);
      setTotalCount(data.count ?? data.results.length);
      setHasMore(Boolean(data.has_more));
      setPage(targetPage);
      setSearched(true);
      setIsBridging(false);
      searchBridgeCache.clear();
    } catch (err) {
      console.log('Search error:', err);
      setIsBridging(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [nlQuery, filters, sort, bridge, results.length]);

  // Pull to refresh: shuffles the properties
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const params: any = { page: 1, limit: 12, sort };
      if (nlQuery.trim()) params.q = nlQuery.trim();
      
      Object.entries(filters).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          if (v.length > 0) params[k] = v.join(',');
        } else if (v !== '' && v != null) {
          params[k] = v;
        }
      });

      const { data } = await api.get('/search', { params });
      const raw = data.results || [];
      const shuffled = shuffleArray(raw);
      setResults(shuffled);
      setTotalCount(data.count ?? raw.length);
      setHasMore(Boolean(data.has_more));
      setPage(1);
      setSearched(true);
      setIsBridging(false);
      searchBridgeCache.clear();
    } catch (err) {
      console.log('Search refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [nlQuery, filters, sort]);

  // Initial load & user role resolution
  useEffect(() => {
    async function loadUser() {
      const uStr = await storage.get('user');
      if (uStr) {
        try {
          setCurrentUser(JSON.parse(uStr));
        } catch {}
      }
    }
    loadUser();
    runSearch(1);
  }, []);

  const isBroker = currentUser?.role === 'broker';

  const toggleSelectForClient = useCallback((propertyId: string | number) => {
    setSelectedIds((prev) => {
      const exists = prev.includes(propertyId);
      if (!exists && prev.length >= 5 && currentUser?.plan === 'free') {
        Alert.alert(
          'Selection Limit Reached',
          'You can only select up to 5 properties at once on the Free plan.'
        );
        return prev;
      }
      return exists ? prev.filter((id) => id !== propertyId) : [...prev, propertyId];
    });
  }, [currentUser?.plan]);

  const handleSearch = () => {
    setShowFilters(false);
    runSearch(1);
  };

  const loadMore = () => {
    if (hasMore && !loadingMore && !loading) {
      runSearch(page + 1, true);
    }
  };

  const handlePropertyPress = useCallback((p: any) => {
    if (p?.id) {
      setPropertyPreview(p.id, p);
      const index = results.findIndex((item: any) => item.id === p.id);
      searchBridgeCache.saveWindow({
        results,
        index: index >= 0 ? index : 0,
        scrollOffset: scrollOffsetRef.current,
        totalCount,
        queryKey,
      });
      router.push(`/properties/${p.id}`);
    }
  }, [results, totalCount, queryKey]);

  const renderPropertyCard = useCallback(({ item: p }: { item: any }) => (
    <PropertyCard
      property={p}
      isSelected={selectedIds.includes(p.id)}
      isBroker={isBroker}
      onSelect={toggleSelectForClient}
      onPress={handlePropertyPress}
    />
  ), [selectedIds, isBroker, toggleSelectForClient, handlePropertyPress]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Search Properties</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={nlQuery}
            onChangeText={setNlQuery}
            placeholder="Search city, locality, or features..."
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <Pressable style={styles.filterToggle} onPress={() => setShowFilters(!showFilters)}>
          <Ionicons name="options-outline" size={24} color="#2563EB" />
        </Pressable>
      </View>

      {/* Filter Section (Collapsible) */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {/* Quick simple filters for now - full modal is better for advanced */}
            <TextInput style={styles.filterInput} placeholder="City" placeholderTextColor="#9CA3AF" value={filters.city} onChangeText={(t) => setFilters({...filters, city: t})} />
            <TextInput style={styles.filterInput} placeholder="BHK" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={filters.bhk} onChangeText={(t) => setFilters({...filters, bhk: t})} />
            <TextInput style={styles.filterInput} placeholder="Min Price" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={filters.price_min} onChangeText={(t) => setFilters({...filters, price_min: t})} />
            <TextInput style={styles.filterInput} placeholder="Max Price" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={filters.price_max} onChangeText={(t) => setFilters({...filters, price_max: t})} />
          </ScrollView>
          <Pressable style={styles.applyFilterButton} onPress={handleSearch}>
            <Text style={styles.applyFilterText}>Apply Filters</Text>
          </Pressable>
        </View>
      )}

      {/* Results */}
      <View style={styles.resultsHeader}>
        {(searched || results.length > 0) && (!loading || results.length > 0) && (
          <Text style={styles.resultsCount}>{totalCount} Properties Found</Text>
        )}
      </View>

      {isBridging && (
        <View style={styles.bridgeBanner}>
          <Text style={styles.bridgeBannerText}>Instant Preview · Updating in background...</Text>
        </View>
      )}

      {loading && results.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={results}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPropertyCard}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={[styles.listContent, selectedIds.length > 0 && { paddingBottom: 180 }]}
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2563EB"
            />
          }
          ListFooterComponent={
            loadingMore || isBridging ? (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#2563EB" />
                {isBridging && (
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>Loading remaining properties...</Text>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            searched ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#D1D5DB" style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>No properties found</Text>
                <Text style={styles.emptySub}>Try adjusting your search or filters.</Text>
              </View>
            ) : null
          }
        />
      )}
      {/* Floating Action Card for Selected Items */}
      {selectedIds.length > 0 && (
        <View style={styles.floatingActionCard}>
          <View style={styles.dockHeaderRow}>
            <Text style={styles.dockCountLabel}>
              {selectedIds.length} {selectedIds.length === 1 ? 'selected' : 'selected'}
            </Text>
            <Pressable
              style={styles.dockCloseBtn}
              onPress={() => setSelectedIds([])}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color="#64748B" />
            </Pressable>
          </View>

          <View style={styles.dockButtonsCol}>
            <Pressable
              style={styles.dockShareBtn}
              onPress={() => setShowShareModal(true)}
            >
              <Ionicons name="share-social" size={16} color="#FFFFFF" />
              <Text style={styles.dockShareBtnText}>Share with Client</Text>
            </Pressable>

            <Pressable
              style={styles.dockCollectionBtn}
              onPress={() => setShowCollectionModal(true)}
            >
              <Ionicons name="albums-outline" size={16} color="#2563EB" />
              <Text style={styles.dockCollectionBtnText}>Add to Collection</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Share with Client Modal */}
      <ShareModal
        visible={showShareModal}
        selectedIds={selectedIds}
        userId={currentUser?.id}
        onClose={() => {
          setShowShareModal(false);
          setSelectedIds([]);
        }}
      />

      {/* Add to Collection Modal */}
      <CollectionModal
        visible={showCollectionModal}
        propertyIds={selectedIds}
        onClose={() => setShowCollectionModal(false)}
        onSuccess={() => {
          setShowCollectionModal(false);
          setSelectedIds([]);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  bridgeBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bridgeBannerText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#1D4ED8',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  searchSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.sans,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  filterToggle: {
    width: 48,
    height: 48,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterScroll: {
    gap: 8,
    marginBottom: 16,
  },
  filterInput: {
    width: 120,
    fontFamily: Fonts.sans,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  applyFilterButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyFilterText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  resultsCount: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 180,
  },
  cardImagePlaceholder: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dummyBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    backgroundColor: 'rgba(250, 204, 21, 0.9)', // yellow-400
    paddingVertical: 4,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EAB308',
  },
  dummyBadgeText: {
    fontFamily: Fonts.monoMedium,
    color: '#713F12', // yellow-900
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cardLocation: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardPrice: {
    fontFamily: Fonts.monoMedium,
    fontSize: 16,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  cardArea: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    fontFamily: Fonts.sansMedium,
    backgroundColor: '#F3F4F6',
    color: '#4B5563',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    fontSize: 10,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySub: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#6B7280',
  },
  selectCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectCardBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  selectCardBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#475569',
  },
  selectCardBtnTextActive: {
    fontFamily: Fonts.sansBold,
    color: '#2563EB',
    fontWeight: '700',
  },
  floatingActionCard: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 99,
  },
  dockHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  dockCountLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  dockCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockButtonsCol: {
    gap: 8,
  },
  dockShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
  },
  dockShareBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dockCollectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    paddingVertical: 12,
    borderRadius: 12,
  },
  dockCollectionBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
});
