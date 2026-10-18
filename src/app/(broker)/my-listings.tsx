import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { statsStore } from '../../lib/statsStore';
import { formatPrice, safeGoBack } from '../../lib/utils';
import { Fonts } from '../../constants/theme';

interface ListingCardProps {
  property: any;
  onToggleStatus: (property: any) => void;
  onDelete: (property: any) => void;
}

const ListingCard = React.memo(function ListingCard({
  property: p,
  onToggleStatus,
  onDelete,
}: ListingCardProps) {
  const { t } = useTranslation();
  const cover = p.property_images?.find((i: any) => i.is_cover)?.url || p.property_images?.[0]?.url;

  return (
    <View style={styles.card}>
      <Pressable onPress={() => router.push(`/properties/${p.id}`)}>
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

        <View style={[
          styles.statusBadge,
          p.status === 'active' ? styles.statusActive :
            p.status === 'sold' ? styles.statusSold : styles.statusInactive
        ]}>
          <Text style={[
            styles.statusText,
            p.status === 'active' ? styles.statusTextActive :
              p.status === 'sold' ? styles.statusTextSold : styles.statusTextInactive
          ]}>{t(`enums.status.${p.status}`, { defaultValue: p.status })}</Text>
        </View>

        {p.is_dummy && (
          <View style={styles.dummyBadge}>
            <Text style={styles.dummyBadgeText}>{t('property.dummyListing')}</Text>
          </View>
        )}

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{p.title}</Text>
          <Text style={styles.cardLocation}>{p.locality}, {p.city}</Text>

          <View style={styles.cardPriceRow}>
            <Text style={styles.cardPrice}>{formatPrice(p.price)}</Text>
            <Text style={styles.cardArea}>· {p.area} {t('property.sqFt')}</Text>
            {p.bhk && <Text style={styles.cardArea}>· {p.bhk} {t('property.bhk')}</Text>}
          </View>
        </View>
      </Pressable>

      <View style={styles.actionsContainer}>
        <Pressable style={[styles.actionBtn, styles.actionToggle]} onPress={() => onToggleStatus(p)}>
          <Text style={styles.actionToggleText} numberOfLines={1}>{p.status === 'active' ? t('myListings.markInactive') : t('myListings.markActive')}</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.actionEdit]} onPress={() => Alert.alert(t('common.comingSoon'), t('myListings.editNotice'))}>
          <Text style={styles.actionEditText} numberOfLines={1}>{t('common.edit')}</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.actionDelete]} onPress={() => onDelete(p)}>
          <Text style={styles.actionDeleteText} numberOfLines={1}>{t('common.delete')}</Text>
        </Pressable>
      </View>
    </View>
  );
});

let memoryMyListings: any[] | null = null;

export default function MyListingsScreen() {
  const { t } = useTranslation();
  const [listings, setListings] = useState<any[]>(memoryMyListings || []);
  const [loading, setLoading] = useState(!memoryMyListings);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    if (!memoryMyListings) setLoading(true);
    try {
      const { data } = await api.get('/properties/my');
      memoryMyListings = data;
      setListings(data);
      const activeCount = data.filter((p: any) => p.status === 'active').length;
      statsStore.setBrokerStats({
        listings: data.length,
        active: activeCount,
        saved: statsStore.getStats()?.broker?.saved ?? 0,
      });
    } catch (e) {
      if (!memoryMyListings) setError('Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = useCallback(async (property: any) => {
    const newStatus = property.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/properties/${property.id}`, { status: newStatus });
      setListings(prev => {
        const next = prev.map(p => (p.id === property.id ? { ...p, status: newStatus } : p));
        memoryMyListings = next;
        return next;
      });
      statsStore.updateListingStatus(property.status, newStatus);
    } catch (e) {
      Alert.alert(t('common.error'), t('myListings.updateFailed'));
    }
  }, [t]);

  const handleDelete = useCallback((property: any) => {
    Alert.alert(
      t('myListings.deleteTitle'),
      `${t('myListings.deleteConfirm')} ("${property.title}")`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/properties/${property.id}`);
              setListings(prev => {
                const next = prev.filter(p => p.id !== property.id);
                memoryMyListings = next;
                return next;
              });
              statsStore.decrementListings(property.status === 'active');
            } catch (e) {
              Alert.alert(t('common.error'), t('myListings.deleteFailed'));
            }
          }
        }
      ]
    );
  }, [t]);

  const filteredListings = useMemo(() => {
    if (!search) return listings;
    const q = search.toLowerCase();
    return listings.filter(p =>
      p.title?.toLowerCase().includes(q) ||
      p.locality?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q)
    );
  }, [listings, search]);

  const renderItem = useCallback(({ item: p }: { item: any }) => (
    <ListingCard property={p} onToggleStatus={toggleStatus} onDelete={handleDelete} />
  ), [toggleStatus, handleDelete]);

    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Pressable>
          <Text style={styles.headerTitle}>{t('myListings.title')}</Text>
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
              placeholder={t('myListings.searchPlaceholder')}
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
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="home-outline" size={48} color="#D1D5DB" style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>{t('myListings.noListingsFound')}</Text>
                <Text style={styles.emptySub}>{t('myListings.noPropertiesYet')}</Text>
                <Pressable style={styles.emptyBtn} onPress={() => router.push('/(broker)/add-property')}>
                  <Text style={styles.emptyBtnText}>{t('myListings.addFirstProperty')}</Text>
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
      fontFamily: Fonts.displaySemiBold,
      fontSize: 18,
      fontWeight: '600',
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
      fontFamily: Fonts.sans,
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
      fontFamily: Fonts.sans,
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
      fontFamily: Fonts.sansBold,
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
      fontFamily: Fonts.monoMedium,
      color: '#713F12', // yellow-900
      fontSize: 10,
      fontWeight: '700',
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
    actionsContainer: {
      flexDirection: 'row',
      padding: 12,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: '#F3F4F6',
      backgroundColor: '#FAFAFA',
      alignItems: 'center',
    },
    actionBtn: {
      paddingVertical: 9,
      paddingHorizontal: 6,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    actionToggle: {
      flex: 1.35,
      borderColor: '#E5E7EB',
      backgroundColor: '#FFFFFF',
    },
    actionToggleText: {
      fontFamily: Fonts.sansSemiBold,
      color: '#4B5563',
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    actionEdit: {
      flex: 0.8,
      borderColor: '#BFDBFE',
      backgroundColor: '#EFF6FF',
    },
    actionEditText: {
      fontFamily: Fonts.sansSemiBold,
      color: '#2563EB',
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    actionDelete: {
      flex: 0.85,
      borderColor: '#FECACA',
      backgroundColor: '#FEF2F2',
    },
    actionDeleteText: {
      fontFamily: Fonts.sansSemiBold,
      color: '#EF4444',
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
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
      marginBottom: 24,
    },
    emptyBtn: {
      backgroundColor: '#2563EB',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
    },
    emptyBtnText: {
      fontFamily: Fonts.sansSemiBold,
      color: '#FFFFFF',
      fontWeight: '600',
    }
  });