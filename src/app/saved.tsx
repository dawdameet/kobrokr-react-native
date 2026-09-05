import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Image, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../lib/api';
import { storage } from '../lib/storage';
import { clearSession } from '../lib/auth';
import { formatPrice } from '../lib/utils';

export default function SavedScreen() {
  const [activeTab, setActiveTab] = useState<'saved' | 'collections'>('saved');
  const [saved, setSaved] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const uStr = await storage.get('user');
      if (uStr) {
        const u = JSON.parse(uStr);
        setUserRole(u.role);
        if (activeTab === 'saved') {
          fetchSaved(u.role);
        } else {
          fetchCollections();
        }
      } else {
        setError('Not logged in');
        setLoading(false);
      }
    }
    init();
  }, [activeTab]);

  const fetchSaved = async (role: string) => {
    setLoading(true);
    try {
      const endpoint = role === 'tenant' ? '/saved/tenant' : '/saved';
      const { data } = await api.get(endpoint);
      setSaved(data);
    } catch (e) {
      setError('Failed to load saved properties');
    } finally {
      setLoading(false);
    }
  };

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/collections');
      setCollections(data);
    } catch (e) {
      setError('Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSaved = async (propertyId: number) => {
    try {
      const endpoint = userRole === 'tenant' ? `/saved/tenant/${propertyId}` : `/saved/${propertyId}`;
      await api.delete(endpoint);
      setSaved(prev => prev.filter(s => s.properties?.id !== propertyId));
    } catch (e) {
      Alert.alert('Error', 'Failed to remove property');
    }
  };

  const handleDeleteCollection = (collectionId: number, name: string) => {
    Alert.alert('Delete Collection', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/collections/${collectionId}`);
            setCollections(prev => prev.filter(c => c.id !== collectionId));
          } catch (e) {
            Alert.alert('Error', 'Failed to delete collection');
          }
        }
      }
    ]);
  };

  const handleRemoveFromCollection = async (collectionId: number, propertyId: number) => {
    try {
      await api.delete(`/collections/${collectionId}/properties/${propertyId}`);
      setCollections(prev => prev.map(c => {
        if (c.id === collectionId) {
          return { ...c, property_ids: c.property_ids.filter((id: number) => id !== propertyId) };
        }
        return c;
      }));
    } catch (e) {
      Alert.alert('Error', 'Failed to remove from collection');
    }
  };

  // --- Renderers ---

  const renderSavedItem = ({ item: s }: { item: any }) => {
    const p = s.properties;
    if (!p) return null;
    const cover = p.property_images?.find((i: any) => i.is_cover)?.url || p.property_images?.[0]?.url;

    return (
      <View style={styles.card}>
        <Pressable onPress={() => router.push(`/properties/${p.id}`)}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.cardImage} />
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
              <Text style={styles.cardArea}>· {p.area} sq ft</Text>
            </View>
          </View>
        </Pressable>
        <View style={styles.actionsContainer}>
          <Pressable style={styles.actionRemoveBtn} onPress={() => handleRemoveSaved(p.id)}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={styles.actionRemoveText}>Remove</Text>
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
          <View>
            <Text style={styles.collectionTitle}>{col.name}</Text>
            <Text style={styles.collectionMeta}>{col.property_ids?.length || 0} / 5 properties</Text>
          </View>
          <Pressable onPress={() => handleDeleteCollection(col.id, col.name)} style={styles.deleteColBtn}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </Pressable>
        </View>

        {(!col.property_ids || col.property_ids.length === 0) ? (
          <View style={styles.emptyColContainer}>
            <Text style={styles.emptyColText}>This collection is empty.</Text>
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
                      <Image source={{ uri: coverImg }} style={styles.colPropImage} />
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Library</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.tabsContainer}>
        <Pressable 
          style={[styles.tab, activeTab === 'saved' && styles.tabActive]} 
          onPress={() => setActiveTab('saved')}
        >
          <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>
            Saved ({activeTab === 'saved' && !loading ? saved.length : '-'})
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 'collections' && styles.tabActive]} 
          onPress={() => setActiveTab('collections')}
        >
          <Text style={[styles.tabText, activeTab === 'collections' && styles.tabTextActive]}>
            Collections ({activeTab === 'collections' && !loading ? collections.length : '-'})
          </Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : activeTab === 'saved' ? (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderSavedItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={48} color="#D1D5DB" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>No saved properties</Text>
              <Text style={styles.emptySub}>Properties you save will appear here.</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/search')}>
                <Text style={styles.emptyBtnText}>Browse Properties</Text>
              </Pressable>
            </View>
          }
        />
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCollection}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={48} color="#D1D5DB" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>No collections yet</Text>
              <Text style={styles.emptySub}>Collections you create will appear here.</Text>
            </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
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
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#2563EB' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#EF4444', fontSize: 14 },
  listContent: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  cardImage: { width: '100%', height: 160, resizeMode: 'cover' },
  cardImagePlaceholder: { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  cardContent: { padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  cardLocation: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'center' },
  cardPrice: { fontSize: 16, fontWeight: 'bold', color: '#1D4ED8' },
  cardArea: { fontSize: 12, color: '#6B7280', marginLeft: 6 },
  actionsContainer: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FAFAFA' },
  actionRemoveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  actionRemoveText: { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  emptyContainer: { paddingVertical: 64, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
  emptyBtn: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '600' },
  
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  collectionMeta: {
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
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  }
});
