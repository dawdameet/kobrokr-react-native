import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  LayoutChangeEvent,
  useWindowDimensions,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { storage } from '../lib/storage';
import { statsStore } from '../lib/statsStore';
import DiscoverVideoCard from '../components/DiscoverVideoCard';
import { Fonts } from '../constants/theme';
import { formatPrice, safeGoBack } from '../lib/utils';

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

type FilterChip = 'all' | 'videos_only' | 'rent' | 'sale' | '2_bhk' | '3_bhk';

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [containerHeight, setContainerHeight] = useState(windowHeight - 130);

  // Reel mode state
  const [properties, setProperties] = useState<any[]>([]);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedChip, setSelectedChip] = useState<FilterChip>('all');
  const [viewMode, setViewMode] = useState<'reels' | 'grid'>('reels');
  const [gridItems, setGridItems] = useState<any[]>([]);
  const [gridLoading, setGridLoading] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Switch to grid mode automatically when user is searching or applying filters
  useEffect(() => {
    if (debouncedQuery.length > 0 || selectedChip !== 'all') {
      setViewMode('grid');
    }
  }, [debouncedQuery, selectedChip]);

  // Load initial discover reel feed
  const fetchFeed = useCallback(async () => {
    try {
      setError('');
      const [searchRes, savedData] = await Promise.all([
        api.get('/search', { params: { limit: 50, sort: 'newest' } }),
        (async () => {
          try {
            const userStr = await storage.get('user');
            const u = userStr ? JSON.parse(userStr) : null;
            const endpoint = u?.role === 'tenant' ? '/saved/tenant' : '/saved';
            const res = await api.get(endpoint);
            return Array.isArray(res.data) ? res.data : [];
          } catch {
            return [];
          }
        })(),
      ]);

      const items: any[] = searchRes.data?.results || [];

      // Build Set of saved IDs
      const ids = new Set<number>();
      for (const item of savedData) {
        const id = item.property_id || item.properties?.id;
        if (id) ids.add(Number(id));
      }
      setSavedIds(ids);

      // ONLY include listings that have a valid walkthrough video for reels
      const withVideo = items.filter(
        (p) => p.property_videos && p.property_videos.length > 0 && p.property_videos.some((v: any) => Boolean(v?.url))
      );

      setProperties(shuffleArray(withVideo));
      setGridItems(items);
      setActiveIndex(0);
    } catch (err: any) {
      console.log('Discover feed error:', err);
      setError('Unable to load Discover feed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Query search API when debouncedQuery changes or filter is applied
  useEffect(() => {
    if (!debouncedQuery && selectedChip === 'all') {
      // Revert to initial feed
      return;
    }

    let isMounted = true;
    async function searchDiscover() {
      setGridLoading(true);
      try {
        const params: any = { limit: 50, sort: 'newest' };
        if (debouncedQuery) {
          params.q = debouncedQuery;
        }
        if (selectedChip === 'rent') {
          params.listing_type = 'rent';
        } else if (selectedChip === 'sale') {
          params.listing_type = 'sale';
        } else if (selectedChip === '2_bhk') {
          params.bhk = 2;
        } else if (selectedChip === '3_bhk') {
          params.bhk = 3;
        }

        const res = await api.get('/search', { params });
        let results: any[] = res.data?.results || [];

        // If videos_only filter is selected, filter properties that have videos
        if (selectedChip === 'videos_only') {
          results = results.filter(
            (p) => p.property_videos && p.property_videos.length > 0 && p.property_videos.some((v: any) => Boolean(v?.url))
          );
        }

        if (isMounted) {
          setGridItems(results);
        }
      } catch (e) {
        console.log('Discover search error:', e);
      } finally {
        if (isMounted) {
          setGridLoading(false);
        }
      }
    }

    searchDiscover();
    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, selectedChip]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 0 && Math.abs(height - containerHeight) > 2) {
      setContainerHeight(height);
    }
  };

  const handleToggleSave = useCallback(async (propertyId: number, nextSaved: boolean) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (nextSaved) next.add(propertyId);
      else next.delete(propertyId);
      return next;
    });

    try {
      const uStr = await storage.get('user');
      const u = uStr ? JSON.parse(uStr) : null;
      const endpoint = u?.role === 'tenant' ? '/saved/tenant' : '/saved';
      if (nextSaved) {
        await api.post(endpoint, { property_id: propertyId });
        statsStore.incrementSaved();
      } else {
        await api.delete(`${endpoint}/${propertyId}`);
        statsStore.decrementSaved();
      }
    } catch (e) {
      console.log('Error toggling save in discover:', e);
    }
  }, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: containerHeight,
      offset: containerHeight * index,
      index,
    }),
    [containerHeight]
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems && viewableItems.length > 0) {
      const firstVisible = viewableItems[0];
      if (firstVisible.index !== null && firstVisible.index !== undefined) {
        setActiveIndex(firstVisible.index);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  // Pinterest Masonry 2-Column Split
  const columnWidth = useMemo(() => {
    const horizontalPadding = 16 * 2;
    const gap = 12;
    return (windowWidth - horizontalPadding - gap) / 2;
  }, [windowWidth]);

  const { leftColumn, rightColumn } = useMemo(() => {
    const left: any[] = [];
    const right: any[] = [];
    let leftHeight = 0;
    let rightHeight = 0;

    gridItems.forEach((item, index) => {
      const hasVideo = Boolean(
        item.property_videos &&
        item.property_videos.length > 0 &&
        item.property_videos.some((v: any) => Boolean(v?.url))
      );

      // Staggered portrait heights (Pinterest aesthetic)
      const baseHeight = hasVideo
        ? (index % 3 === 0 ? 270 : 240)
        : (index % 2 === 0 ? 210 : 230);

      const itemWithHeight = {
        ...item,
        cardHeight: baseHeight,
        hasVideo,
      };

      if (leftHeight <= rightHeight) {
        left.push(itemWithHeight);
        leftHeight += baseHeight + 12;
      } else {
        right.push(itemWithHeight);
        rightHeight += baseHeight + 12;
      }
    });

    return { leftColumn: left, rightColumn: right };
  }, [gridItems]);

  const handleCardPress = (property: any) => {
    router.push(`/properties/${property.id}`);
  };

  const handleWatchReel = (property: any) => {
    // If it has a video, switch to reels mode and play this video
    const idx = properties.findIndex(p => p.id === property.id);
    if (idx >= 0) {
      setActiveIndex(idx);
      setViewMode('reels');
    } else {
      // If not in reels list, add it and play
      setProperties(prev => [property, ...prev]);
      setActiveIndex(0);
      setViewMode('reels');
    }
  };

  const renderMasonryCard = (item: any) => {
    const isSaved = savedIds.has(item.id);
    const coverImage =
      item.property_images?.find((img: any) => img.is_cover)?.url ||
      item.property_images?.[0]?.url;

    return (
      <Pressable
        key={item.id}
        style={[
          styles.masonryCard,
          { width: columnWidth, height: item.cardHeight },
        ]}
        onPress={() => handleCardPress(item)}
      >
        {/* Background Media */}
        {coverImage ? (
          <Image
            source={{ uri: coverImage }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.cardImageFallback]}>
            <Ionicons name="home-outline" size={32} color="#94A3B8" />
          </View>
        )}

        {/* Gradient Scrim for Legibility */}
        <View style={styles.cardBottomScrim} />

        {/* Top Badges */}
        <View style={styles.cardTopRow}>
          {item.hasVideo ? (
            <Pressable
              style={styles.videoBadge}
              onPress={(e) => {
                e.stopPropagation();
                handleWatchReel(item);
              }}
            >
              <Ionicons name="play" size={11} color="#FFFFFF" />
              <Text style={styles.videoBadgeText}>Watch</Text>
            </Pressable>
          ) : (
            <View style={styles.photoBadge}>
              <Ionicons name="image-outline" size={11} color="#334155" />
              <Text style={styles.photoBadgeText}>Photo</Text>
            </View>
          )}

          <Pressable
            style={styles.cardHeartBtn}
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation();
              handleToggleSave(item.id, !isSaved);
            }}
          >
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={17}
              color={isSaved ? '#EF4444' : '#FFFFFF'}
            />
          </Pressable>
        </View>

        {/* Bottom Property Info */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardPrice} numberOfLines={1}>
            {formatPrice(item.price)}
          </Text>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.bhk ? `${item.bhk} BHK` : ''}
            {item.bhk && item.locality ? ' · ' : ''}
            {item.locality || item.city || item.title}
          </Text>
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardTypeBadge} numberOfLines={1}>
              {item.listing_type === 'rent' ? 'Rent' : 'Buy'} · {item.type}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>

        <Text style={styles.headerTitle}>{t('nav.discover', { defaultValue: 'Discover' })}</Text>

        {/* View Mode Toggle (Reels vs Masonry Grid) */}
        <View style={styles.modeToggleContainer}>
          <Pressable
            style={[styles.modeToggleBtn, viewMode === 'reels' && styles.modeToggleBtnActive]}
            onPress={() => {
              setViewMode('reels');
              setSearchQuery('');
            }}
          >
            <Ionicons
              name="film"
              size={16}
              color={viewMode === 'reels' ? '#2563EB' : '#64748B'}
            />
          </Pressable>
          <Pressable
            style={[styles.modeToggleBtn, viewMode === 'grid' && styles.modeToggleBtnActive]}
            onPress={() => setViewMode('grid')}
          >
            <Ionicons
              name="grid"
              size={16}
              color={viewMode === 'grid' ? '#2563EB' : '#64748B'}
            />
          </Pressable>
        </View>
      </View>

      {/* Discover Search Bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search videos, locality, BHK..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {!!searchQuery && (
            <Pressable
              onPress={() => setSearchQuery('')}
              style={styles.searchClearBtn}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        {/* Quick Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          <Pressable
            style={[styles.chip, selectedChip === 'all' && styles.chipActive]}
            onPress={() => setSelectedChip('all')}
          >
            <Text style={[styles.chipText, selectedChip === 'all' && styles.chipTextActive]}>
              All
            </Text>
          </Pressable>

          <Pressable
            style={[styles.chip, selectedChip === 'videos_only' && styles.chipActive]}
            onPress={() => setSelectedChip('videos_only')}
          >
            <Ionicons
              name="videocam"
              size={13}
              color={selectedChip === 'videos_only' ? '#FFFFFF' : '#2563EB'}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.chipText, selectedChip === 'videos_only' && styles.chipTextActive]}>
              Videos Only
            </Text>
          </Pressable>

          <Pressable
            style={[styles.chip, selectedChip === 'rent' && styles.chipActive]}
            onPress={() => setSelectedChip(selectedChip === 'rent' ? 'all' : 'rent')}
          >
            <Text style={[styles.chipText, selectedChip === 'rent' && styles.chipTextActive]}>
              Rent
            </Text>
          </Pressable>

          <Pressable
            style={[styles.chip, selectedChip === 'sale' && styles.chipActive]}
            onPress={() => setSelectedChip(selectedChip === 'sale' ? 'all' : 'sale')}
          >
            <Text style={[styles.chipText, selectedChip === 'sale' && styles.chipTextActive]}>
              Buy
            </Text>
          </Pressable>

          <Pressable
            style={[styles.chip, selectedChip === '2_bhk' && styles.chipActive]}
            onPress={() => setSelectedChip(selectedChip === '2_bhk' ? 'all' : '2_bhk')}
          >
            <Text style={[styles.chipText, selectedChip === '2_bhk' && styles.chipTextActive]}>
              2 BHK
            </Text>
          </Pressable>

          <Pressable
            style={[styles.chip, selectedChip === '3_bhk' && styles.chipActive]}
            onPress={() => setSelectedChip(selectedChip === '3_bhk' ? 'all' : '3_bhk')}
          >
            <Text style={[styles.chipText, selectedChip === '3_bhk' && styles.chipTextActive]}>
              3 BHK
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {viewMode === 'reels' ? (
        /* Fullscreen Reel Mode */
        <View style={styles.feedWrapper} onLayout={handleLayout}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : error && properties.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="videocam-off-outline" size={48} color="#9CA3AF" style={{ marginBottom: 12 }} />
              <Text style={styles.errorText}>{error || t('discover.loadError')}</Text>
              <Pressable style={styles.retryBtn} onPress={fetchFeed}>
                <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : properties.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="videocam-outline" size={48} color="#9CA3AF" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>{t('discover.noWalkthroughs')}</Text>
              <Text style={styles.emptySubtitle}>{t('discover.checkBackSoon')}</Text>
            </View>
          ) : (
            <FlatList
              data={properties}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item, index }) => (
                <DiscoverVideoCard
                  property={item}
                  isActive={index === activeIndex}
                  isMuted={isMuted}
                  isSaved={savedIds.has(item.id)}
                  onToggleSave={handleToggleSave}
                  onToggleMute={() => setIsMuted(prev => !prev)}
                  height={containerHeight}
                />
              )}
              getItemLayout={getItemLayout}
              windowSize={3}
              maxToRenderPerBatch={2}
              initialNumToRender={2}
              removeClippedSubviews={Platform.OS === 'android'}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              snapToInterval={containerHeight}
              snapToAlignment="start"
              decelerationRate="fast"
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#2563EB"
                />
              }
            />
          )}
        </View>
      ) : (
        /* Pinterest-style Masonry Grid Mode */
        <ScrollView
          style={styles.gridScrollView}
          contentContainerStyle={styles.gridScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2563EB"
            />
          }
        >
          {gridLoading ? (
            <View style={styles.gridLoadingBox}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.gridLoadingText}>Filtering properties...</Text>
            </View>
          ) : gridItems.length === 0 ? (
            <View style={styles.emptySearchBox}>
              <Ionicons name="search-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptySearchTitle}>No matching results</Text>
              <Text style={styles.emptySearchSubtitle}>
                Try adjusting your search terms or selecting a different filter chip.
              </Text>
              <Pressable
                style={styles.clearSearchBtn}
                onPress={() => {
                  setSearchQuery('');
                  setSelectedChip('all');
                }}
              >
                <Text style={styles.clearSearchBtnText}>Reset Search</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.masonryContainer}>
              {/* Left Column */}
              <View style={styles.masonryColumn}>
                {leftColumn.map(renderMasonryCard)}
              </View>

              {/* Right Column */}
              <View style={styles.masonryColumn}>
                {rightColumn.map(renderMasonryCard)}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 50,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 3,
    gap: 2,
  },
  modeToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  searchBarWrapper: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
  },
  chipsScroll: {
    paddingTop: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#475569',
  },
  chipTextActive: {
    fontFamily: Fonts.sansBold,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  feedWrapper: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 14,
  },
  emptyTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  gridScrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  gridScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  gridLoadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  gridLoadingText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#64748B',
  },
  emptySearchBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptySearchTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptySearchSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  clearSearchBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  clearSearchBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  masonryContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  masonryColumn: {
    flex: 1,
    gap: 12,
  },
  masonryCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    position: 'relative',
  },
  cardImageFallback: {
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  cardTopRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  videoBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoBadgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 10,
    color: '#334155',
  },
  cardHeartBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    zIndex: 10,
  },
  cardPrice: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: '#F8FAFC',
    marginBottom: 4,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTypeBadge: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#CBD5E1',
    textTransform: 'capitalize',
  },
});
