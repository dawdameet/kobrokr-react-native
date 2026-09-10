import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../lib/api';
import DiscoverVideoCard from '../components/DiscoverVideoCard';
import { Fonts } from '../constants/theme';
import { safeGoBack } from '../lib/utils';

export default function DiscoverScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [containerHeight, setContainerHeight] = useState(windowHeight);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  const fetchFeed = useCallback(async () => {
    try {
      setError('');
      // Fetch latest properties with video support
      const { data } = await api.get('/search', {
        params: { limit: 50, sort: 'newest' },
      });
      const items: any[] = data?.results || [];

      // Prioritize listings that have video walkthroughs first, followed by others
      const sorted = [...items].sort((a, b) => {
        const aHasVideo = (a.property_videos && a.property_videos.length > 0) ? 1 : 0;
        const bHasVideo = (b.property_videos && b.property_videos.length > 0) ? 1 : 0;
        return bHasVideo - aHasVideo;
      });

      setProperties(sorted);
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

  return (
    <View style={styles.container}>
      {/* Main Feed Container - Fullscreen */}
      <View style={styles.feedWrapper} onLayout={handleLayout}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading Walkthroughs...</Text>
          </View>
        ) : error && properties.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="videocam-off-outline" size={48} color="#9CA3AF" style={{ marginBottom: 12 }} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={fetchFeed}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : properties.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="videocam-outline" size={48} color="#9CA3AF" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No Walkthroughs Yet</Text>
            <Text style={styles.emptySubtitle}>Check back soon for new property video tours.</Text>
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
                onToggleMute={() => setIsMuted(prev => !prev)}
                height={containerHeight}
              />
            )}
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

      {/* Floating Transparent Topbar */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable onPress={() => safeGoBack()} style={styles.headerIconBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Discover</Text>
        <Pressable onPress={() => router.push('/search')} style={styles.headerIconBtn}>
          <Ionicons name="search" size={20} color="#111827" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    zIndex: 50,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
});
