import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator, Image, Modal, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../lib/api';
import { storage } from '../lib/storage';
import { clearSession } from '../lib/auth';
import { formatPrice } from '../lib/utils';
import { Fonts } from '../constants/theme';

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

export default function SearchScreen() {
  const [nlQuery, setNlQuery] = useState('');
  const [filters, setFilters] = useState<any>({
    city: '', locality: '', type: '', bhk: '', price_min: '', price_max: '', listing_type: '', area_min: '', amenities: []
  });
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [searched, setSearched] = useState(false);

  // Fetch results
  const runSearch = useCallback(async (targetPage = 1, append = false) => {
    if (append) setLoadingMore(true);
    else { setLoading(true); setSearched(false); }

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
    } catch (err) {
      console.log('Search error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [nlQuery, filters, sort]);

  // Initial load
  useEffect(() => {
    runSearch(1);
  }, []);

  const handleSearch = () => {
    setShowFilters(false);
    runSearch(1);
  };

  const loadMore = () => {
    if (hasMore && !loadingMore && !loading) {
      runSearch(page + 1, true);
    }
  };

  const renderPropertyCard = ({ item: p }: { item: any }) => {
    const cover = p.property_images?.find((i: any) => i.is_cover)?.url || p.property_images?.[0]?.url;
    
    return (
      <Pressable 
        style={styles.card} 
        onPress={() => router.push(`/properties/${p.id}`)}
      >
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cardImage} />
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
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
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
            <TextInput style={styles.filterInput} placeholder="City" value={filters.city} onChangeText={(t) => setFilters({...filters, city: t})} />
            <TextInput style={styles.filterInput} placeholder="BHK" keyboardType="numeric" value={filters.bhk} onChangeText={(t) => setFilters({...filters, bhk: t})} />
            <TextInput style={styles.filterInput} placeholder="Min Price" keyboardType="numeric" value={filters.price_min} onChangeText={(t) => setFilters({...filters, price_min: t})} />
            <TextInput style={styles.filterInput} placeholder="Max Price" keyboardType="numeric" value={filters.price_max} onChangeText={(t) => setFilters({...filters, price_max: t})} />
          </ScrollView>
          <Pressable style={styles.applyFilterButton} onPress={handleSearch}>
            <Text style={styles.applyFilterText}>Apply Filters</Text>
          </Pressable>
        </View>
      )}

      {/* Results */}
      <View style={styles.resultsHeader}>
        {searched && !loading && (
          <Text style={styles.resultsCount}>{totalCount} Properties Found</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPropertyCard}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator size="small" color="#2563EB" style={{ margin: 16 }} /> : null
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
  }
});
