import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../lib/api';
import { storage } from '../lib/storage';

export default function SavedScreen() {
  const [saved, setSaved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const uStr = await storage.get('user');
      if (uStr) {
        const u = JSON.parse(uStr);
        setUserRole(u.role);
        fetchSaved(u.role);
      } else {
        setError('Not logged in');
        setLoading(false);
      }
    }
    init();
  }, []);

  const fetchSaved = async (role: string) => {
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

  const handleRemove = async (propertyId: number) => {
    try {
      const endpoint = userRole === 'tenant' ? `/saved/tenant/${propertyId}` : `/saved/${propertyId}`;
      await api.delete(endpoint);
      setSaved(prev => prev.filter(s => s.properties?.id !== propertyId));
    } catch (e) {
      Alert.alert('Error', 'Failed to remove property');
    }
  };

  const formatPrice = (p: number) => {
    if (!p) return '—';
    if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
    if (p >= 100000) return `₹${(p / 100000).toFixed(1)} L`;
    return `₹${p.toLocaleString()}`;
  };

  const renderItem = ({ item: s }: { item: any }) => {
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
          <Pressable style={styles.actionRemoveBtn} onPress={() => handleRemove(p.id)}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={styles.actionRemoveText}>Remove</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Saved Properties</Text>
        <View style={{ width: 32 }} />
      </View>

      {error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
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
    height: 160,
    resizeMode: 'cover',
  },
  cardImagePlaceholder: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cardLocation: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1D4ED8',
  },
  cardArea: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
  },
  actionRemoveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  actionRemoveText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  }
});
