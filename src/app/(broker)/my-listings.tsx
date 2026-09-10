import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Image, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';

export default function MyListingsScreen() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const { data } = await api.get('/properties/my');
      setListings(data);
    } catch (e) {
      setError('Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (property: any) => {
    const newStatus = property.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/properties/${property.id}`, { status: newStatus });
      setListings(prev =>
        prev.map(p => (p.id === property.id ? { ...p, status: newStatus } : p))
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleDelete = (property: any) => {
    Alert.alert(
      'Delete Listing',
      `Are you sure you want to delete "${property.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/properties/${property.id}`);
              setListings(prev => prev.filter(p => p.id !== property.id));
            } catch (e) {
              Alert.alert('Error', 'Failed to delete listing');
            }
          }
        }
      ]
    );
  };

  const filteredListings = listings.filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.title?.toLowerCase().includes(q) ||
        p.locality?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q)
      );
    });

    const renderItem = ({ item: p }: { item: any }) => {
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

            <View style={[
              styles.statusBadge,
              p.status === 'active' ? styles.statusActive :
                p.status === 'sold' ? styles.statusSold : styles.statusInactive
            ]}>
              <Text style={[
                styles.statusText,
                p.status === 'active' ? styles.statusTextActive :
                  p.status === 'sold' ? styles.statusTextSold : styles.statusTextInactive
              ]}>{p.status}</Text>
            </View>

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
                {p.bhk && <Text style={styles.cardArea}>· {p.bhk} BHK</Text>}
              </View>
            </View>
          </Pressable>

          <View style={styles.actionsContainer}>
            <Pressable style={[styles.actionBtn, styles.actionToggle]} onPress={() => toggleStatus(p)}>
              <Text style={styles.actionToggleText}>{p.status === 'active' ? 'Mark Inactive' : 'Mark Active'}</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.actionEdit]} onPress={() => Alert.alert('Coming Soon', 'Edit functionality will be added in a future update.')}>
              <Text style={styles.actionEditText}>Edit</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.actionDelete]} onPress={() => handleDelete(p)}>
              <Text style={styles.actionDeleteText}>Delete</Text>
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
          <Text style={styles.headerTitle}>My Listings</Text>
          <Pressable onPress={() => router.push('/(broker)/add-property')} style={styles.addButton}>
            <Ionicons name="add" size={24} color="#2563EB" />
          </Pressable>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by title or locality..."
              placeholderTextColor="#9CA3AF"
            />
          </View>
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
            data={filteredListings}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="home-outline" size={48} color="#D1D5DB" style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>No listings found</Text>
                <Text style={styles.emptySub}>You haven't added any properties yet.</Text>
                <Pressable style={styles.emptyBtn} onPress={() => router.push('/(broker)/add-property')}>
                  <Text style={styles.emptyBtnText}>Add your first property</Text>
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
    addButton: {
      padding: 4,
      backgroundColor: '#EFF6FF',
      borderRadius: 8,
    },
    searchSection: {
      padding: 16,
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F9FAFB',
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
      paddingVertical: 10,
      fontSize: 14,
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
    statusBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 9999,
    },
    statusActive: { backgroundColor: '#DCFCE7' },
    statusInactive: { backgroundColor: '#F3F4F6' },
    statusSold: { backgroundColor: '#DBEAFE' },
    statusText: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    statusTextActive: { color: '#15803D' },
    statusTextInactive: { color: '#6B7280' },
    statusTextSold: { color: '#1D4ED8' },
    dummyBadge: {
      position: 'absolute',
      top: 12,
      left: 12,
      backgroundColor: 'rgba(250, 204, 21, 0.9)', // yellow-400
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    dummyBadgeText: {
      color: '#713F12', // yellow-900
      fontSize: 10,
      fontWeight: 'bold',
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
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: '#F3F4F6',
      backgroundColor: '#FAFAFA',
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
    },
    actionToggle: {
      borderColor: '#E5E7EB',
      backgroundColor: '#FFFFFF',
    },
    actionToggleText: {
      color: '#4B5563',
      fontSize: 12,
      fontWeight: '600',
    },
    actionEdit: {
      borderColor: '#BFDBFE',
      backgroundColor: '#EFF6FF',
    },
    actionEditText: {
      color: '#2563EB',
      fontSize: 12,
      fontWeight: '600',
    },
    actionDelete: {
      borderColor: '#FECACA',
      backgroundColor: '#FEF2F2',
    },
    actionDeleteText: {
      color: '#EF4444',
      fontSize: 12,
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