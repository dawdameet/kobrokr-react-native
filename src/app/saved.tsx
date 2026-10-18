import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, ScrollView, Platform, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { storage } from '../lib/storage';
import { formatPrice, safeGoBack } from '../lib/utils';
import { Fonts } from '../constants/theme';
import ShareModal from '../components/ShareModal';
import { setPropertyPreview } from '../lib/propertyCache';
import { statsStore } from '../lib/statsStore';
import { libraryStore } from '../lib/libraryStore';

export default function SavedScreen() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'saved' | 'collections'>('saved');

  // Initialize immediately from synchronous in-memory cache if available
  const initialCache = libraryStore.getState();
  const [saved, setSaved] = useState<any[]>(initialCache?.saved || []);
  const [collections, setCollections] = useState<any[]>(initialCache?.collections || []);
  const [loading, setLoading] = useState<boolean>(!initialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sharePropertyIds, setSharePropertyIds] = useState<(string | number)[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);

  // Fetch both saved and collections in parallel without blocking active tab
  const fetchLibraryData = useCallback(async (role: string, isPullRefresh = false) => {
    if (!isPullRefresh && !libraryStore.getState()) {
      setLoading(true);
    }
    try {
      const savedEndpoint = role === 'tenant' ? '/saved/tenant' : '/saved';
      const [savedRes, colRes] = await Promise.allSettled([
        api.get(savedEndpoint),
        api.get('/collections'),
      ]);

      let newSaved = libraryStore.getState()?.saved || [];
      if (savedRes.status === 'fulfilled' && Array.isArray(savedRes.value.data)) {
        newSaved = savedRes.value.data;
        setSaved(newSaved);
        if (role === 'tenant') {
          statsStore.setTenantStats({ saved: newSaved.length });
        } else {
          const broker = statsStore.getStats()?.broker;
          if (broker) {
            statsStore.setBrokerStats({ ...broker, saved: newSaved.length });
          }
        }
      }

      let newCols = libraryStore.getState()?.collections || [];
      if (colRes.status === 'fulfilled' && Array.isArray(colRes.value.data)) {
        newCols = colRes.value.data;
        setCollections(newCols);
      }

      libraryStore.setLibraryData({ saved: newSaved, collections: newCols });
      setError('');
    } catch (e) {
      if (!libraryStore.getState()) {
        setError(t('library.failedLoadSaved'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      // 1. If memory state is empty, check AsyncStorage
      if (!libraryStore.getState()) {
        const stored = await libraryStore.init();
        if (stored && isMounted) {
          setSaved(stored.saved || []);
          setCollections(stored.collections || []);
          setLoading(false);
        }
      }

      // 2. Fetch fresh user & data
      const uStr = await storage.get('user');
      if (uStr && isMounted) {
        const u = JSON.parse(uStr);
        setCurrentUser(u);
        setUserRole(u.role);
        fetchLibraryData(u.role);
      } else if (!uStr && isMounted) {
        setError('Not logged in');
        setLoading(false);
      }
    }

    init();

    const unsubscribe = libraryStore.subscribe((state) => {
      if (state && isMounted) {
        setSaved(state.saved || []);
        setCollections(state.collections || []);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [fetchLibraryData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (currentUser?.role) {
      fetchLibraryData(currentUser.role, true);
    } else {
      setRefreshing(false);
    }
  }, [currentUser?.role, fetchLibraryData]);

  const handleRemoveSaved = async (propertyId: number) => {
    const prevSaved = saved;
    const nextSaved = prevSaved.filter((s) => (s.properties?.id ?? s.property_id) !== propertyId);
    setSaved(nextSaved);
    libraryStore.removeSaved(propertyId);
    statsStore.decrementSaved();

    try {
      const endpoint = userRole === 'tenant' ? `/saved/tenant/${propertyId}` : `/saved/${propertyId}`;
      await api.delete(endpoint);
    } catch (e) {
      setSaved(prevSaved);
      libraryStore.setLibraryData({ saved: prevSaved });
      statsStore.incrementSaved();
      Alert.alert(t('common.error'), t('library.failedRemoveProperty'));
    }
  };

  const handleDeleteCollection = (collectionId: number, name: string) => {
    Alert.alert(t('library.deleteCollection'), `${t('library.deleteCollectionConfirm')} "${name}"?`, [
      { text: t('common.cancel'), style: 'cancel' },
      { 
        text: t('common.delete'), 
        style: 'destructive',
        onPress: async () => {
          const prevCols = collections;
          const nextCols = prevCols.filter((c) => c.id !== collectionId);
          setCollections(nextCols);
          libraryStore.removeCollection(collectionId);
          try {
            await api.delete(`/collections/${collectionId}`);
          } catch (e) {
            setCollections(prevCols);
            libraryStore.setLibraryData({ collections: prevCols });
            Alert.alert(t('common.error'), t('library.failedDeleteCollection'));
          }
        }
      }
    ]);
  };

  const handleRemoveFromCollection = async (collectionId: number, propertyId: number) => {
    const prevCols = collections;
    const nextCols = prevCols.map((c) => {
      if (c.id === collectionId) {
        return {
          ...c,
          property_ids: (c.property_ids || []).filter((id: number) => id !== propertyId),
        };
      }
      return c;
    });
    setCollections(nextCols);
    libraryStore.removePropertyFromCollection(collectionId, propertyId);

    try {
      await api.delete(`/collections/${collectionId}/properties/${propertyId}`);
    } catch (e) {
      setCollections(prevCols);
      libraryStore.setLibraryData({ collections: prevCols });
      Alert.alert(t('common.error'), t('library.failedRemoveFromCollection'));
    }
  };

  // --- Renderers ---

  const renderSavedItem = ({ item: s }: { item: any }) => {
    const p = s.properties;
    if (!p) return null;
    const cover = p.property_images?.find((i: any) => i.is_cover)?.url || p.property_images?.[0]?.url;

    return (
      <View style={styles.card}>
        <Pressable onPress={() => {
          setPropertyPreview(p.id, p);
          router.push(`/properties/${p.id}`);
        }}>
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
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>{p.title}</Text>
            <Text style={styles.cardLocation}>{p.locality}, {p.city}</Text>
            <View style={styles.cardPriceRow}>
              <Text style={styles.cardPrice}>{formatPrice(p.price)}</Text>
              <Text style={styles.cardArea}>· {p.area} {t('property.sqFt')}</Text>
            </View>
          </View>
        </Pressable>
        <View style={styles.actionsContainer}>
          <Pressable style={styles.actionRemoveBtn} onPress={() => handleRemoveSaved(p.id)}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={styles.actionRemoveText}>{t('library.remove')}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderCollection = ({ item: col }: { item: any }) => {
    const propMap: any = {};
    (col.properties || []).forEach((p: any) => { propMap[p.id] = p; });

    return (
      <View style={styles.collectionCard}>
        <View style={styles.collectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.collectionTitle}>{col.name}</Text>
            <Text style={styles.collectionMeta}>{col.property_ids?.length || 0} / 5 {t('library.propertiesCount')}</Text>
          </View>
          <View style={styles.collectionHeaderActions}>
            {userRole === 'broker' && (
              <Pressable
                style={[
                  styles.shareColBtn,
                  (!col.property_ids || col.property_ids.length === 0) && styles.shareColBtnDisabled,
                ]}
                disabled={!col.property_ids || col.property_ids.length === 0}
                onPress={() => {
                  setSharePropertyIds(col.property_ids || []);
                  setShowShareModal(true);
                }}
              >
                <Ionicons name="share-social-outline" size={14} color="#2563EB" />
                <Text style={styles.shareColBtnText}>{t('common.share')}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => handleDeleteCollection(col.id, col.name)} style={styles.deleteColBtn}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </Pressable>
          </View>
        </View>

        {(!col.property_ids || col.property_ids.length === 0) ? (
          <View style={styles.emptyColContainer}>
            <Text style={styles.emptyColText}>{t('library.emptyCollection')}</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colScroll}>
            {col.property_ids.map((pid: number) => {
              const prop = propMap[pid];
              const coverImg = prop?.property_images?.find((i: any) => i.is_cover)?.url || prop?.property_images?.[0]?.url;

              return (
                <Pressable key={pid} onPress={() => router.push(`/properties/${pid}`)} style={styles.colPropItem}>
                  <View style={styles.colPropImageWrapper}>
                    {coverImg ? (
                      <Image
                        source={{ uri: coverImg }}
                        style={styles.colPropImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={150}
                      />
                    ) : (
                      <View style={[styles.colPropImage, styles.cardImagePlaceholder]}>
                        <Ionicons name="home-outline" size={24} color="#D1D5DB" />
                      </View>
                    )}
                    <Pressable 
                      style={styles.colPropRemoveBtn} 
                      onPress={(e) => { e.stopPropagation(); handleRemoveFromCollection(col.id, pid); }}
                    >
                      <Ionicons name="close" size={14} color="#EF4444" />
                    </Pressable>
                  </View>
                  <Text style={styles.colPropTitle} numberOfLines={1}>
                    {prop?.title || `ID: ${pid}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('library.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.tabsContainer}>
        <Pressable 
          style={[styles.tab, activeTab === 'saved' && styles.tabActive]} 
          onPress={() => setActiveTab('saved')}
        >
          <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>
            {t('library.tabSaved')} ({saved.length})
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 'collections' && styles.tabActive]} 
          onPress={() => setActiveTab('collections')}
        >
          <Text style={[styles.tabText, activeTab === 'collections' && styles.tabTextActive]}>
            {t('library.tabCollections')} ({collections.length})
          </Text>
        </Pressable>
      </View>

      {error && !saved.length && !collections.length ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : loading && !saved.length && !collections.length ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : activeTab === 'saved' ? (
        <FlatList
          data={saved}
          keyExtractor={(item) => (item.id || item.property_id || Math.random()).toString()}
          renderItem={renderSavedItem}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2563EB']}
              tintColor="#2563EB"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={48} color="#D1D5DB" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>{t('library.noSavedProperties')}</Text>
              <Text style={styles.emptySub}>{t('library.noSavedPropertiesSub')}</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/search')}>
                <Text style={styles.emptyBtnText}>{t('library.browseProperties')}</Text>
              </Pressable>
            </View>
          }
        />
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => (item.id || Math.random()).toString()}
          renderItem={renderCollection}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2563EB']}
              tintColor="#2563EB"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={48} color="#D1D5DB" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>{t('library.noCollectionsYet')}</Text>
              <Text style={styles.emptySub}>{t('library.noCollectionsSub')}</Text>
            </View>
          }
        />
      )}

      {/* Share with Client Modal */}
      <ShareModal
        visible={showShareModal}
        selectedIds={sharePropertyIds}
        userId={currentUser?.id}
        onClose={() => {
          setShowShareModal(false);
          setSharePropertyIds([]);
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
  backButton: { padding: 4 },
  headerTitle: { fontFamily: Fonts.displaySemiBold, fontSize: 18, fontWeight: '600', color: '#111827' },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#2563EB' },
  tabText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#2563EB' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontFamily: Fonts.sans, color: '#EF4444', fontSize: 14 },
  listContent: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  cardImage: { width: '100%', height: 160 },
  cardImagePlaceholder: { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  cardContent: { padding: 16 },
  cardTitle: { fontFamily: Fonts.sansSemiBold, fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  cardLocation: { fontFamily: Fonts.sans, fontSize: 12, color: '#6B7280', marginBottom: 8 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'center' },
  cardPrice: { fontFamily: Fonts.monoMedium, fontSize: 16, fontWeight: '600', color: '#1D4ED8' },
  cardArea: { fontFamily: Fonts.sans, fontSize: 12, color: '#6B7280', marginLeft: 6 },
  actionsContainer: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FAFAFA' },
  actionRemoveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  actionRemoveText: { fontFamily: Fonts.sansSemiBold, color: '#EF4444', fontSize: 14, fontWeight: '600' },
  emptyContainer: { paddingVertical: 64, alignItems: 'center' },
  emptyTitle: { fontFamily: Fonts.displaySemiBold, fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 8 },
  emptySub: { fontFamily: Fonts.sans, fontSize: 14, color: '#6B7280', marginBottom: 24 },
  emptyBtn: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontFamily: Fonts.sansSemiBold, color: '#FFFFFF', fontWeight: '600' },
  
  // Collections styles
  collectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 12,
  },
  collectionTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  collectionMeta: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  deleteColBtn: {
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  emptyColContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyColText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#9CA3AF',
  },
  colScroll: {
    flexDirection: 'row',
  },
  colPropItem: {
    width: 120,
    marginRight: 12,
  },
  colPropImageWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
    marginBottom: 8,
  },
  colPropImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  colPropRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
  colPropTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  collectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareColBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  shareColBtnDisabled: {
    opacity: 0.5,
  },
  shareColBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
});
