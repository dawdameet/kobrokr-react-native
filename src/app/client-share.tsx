import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { formatPrice, safeGoBack } from '../lib/utils';
import { Fonts } from '../constants/theme';

export default function ClientShareScreen() {
  const { b: brokerId, p: propertyIds } = useLocalSearchParams<{
    b?: string;
    p?: string;
  }>();

  const [broker, setBroker] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!brokerId || !propertyIds) {
      setError('Invalid share link. Please verify the collection URL.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [brokerRes, propsRes] = await Promise.all([
          api.get(`/broker/${brokerId}/public`),
          api.get(`/properties/shared?ids=${propertyIds}`),
        ]);
        setBroker(brokerRes.data);
        setProperties(propsRes.data || []);
      } catch (err) {
        setError('Failed to load collection. The link may have expired or is invalid.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [brokerId, propertyIds]);

  const handleCall = (phone: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsAppProperty = (p: any) => {
    if (!broker?.mobile) return;
    const cleanPhone = broker.mobile.replace(/\D/g, '');
    const phoneFormatted = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const firstName = broker.full_name?.split(' ')[0] || 'there';
    const message = `Hi ${firstName}, I'm interested in the property: ${p.title} (${p.locality || p.city}).`;
    Linking.openURL(`https://wa.me/${phoneFormatted}?text=${encodeURIComponent(message)}`);
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading property collection...</Text>
      </SafeAreaView>
    );
  }

  if (error || !broker) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, styles.center]}>
        <View style={styles.errorIconBox}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        </View>
        <Text style={styles.errorTitle}>Collection Unavailable</Text>
        <Text style={styles.errorSubtitle}>{error || 'Unable to display properties'}</Text>
        <Pressable style={styles.errorBtn} onPress={() => safeGoBack('/')}>
          <Text style={styles.errorBtnText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const renderPropertyItem = ({ item: p }: { item: any }) => {
    const cover =
      p.property_images?.find((i: any) => i.is_cover)?.url ||
      p.property_images?.[0]?.url;

    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/properties/${p.id}?b=${brokerId}` as any)}
      >
        {/* Card Image */}
        <View style={styles.cardImageWrapper}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImage, styles.placeholderImage]}>
              <Ionicons name="home-outline" size={36} color="#CBD5E1" />
            </View>
          )}

          <View style={styles.priceTag}>
            <Text style={styles.priceTagText}>{formatPrice(p.price)}</Text>
          </View>
        </View>

        {/* Card Body */}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {p.title}
          </Text>
          <Text style={styles.cardLocality} numberOfLines={1}>
            {p.locality ? `${p.locality}, ${p.city}` : p.city}
          </Text>

          {/* Specs / Badges */}
          <View style={styles.tagsRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{p.type}</Text>
            </View>
            {p.listing_type && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>
                  {p.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
                </Text>
              </View>
            )}
            {!!p.bhk && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{p.bhk} BHK</Text>
              </View>
            )}
            {!!p.washrooms && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{p.washrooms} Bath</Text>
              </View>
            )}
            {!!p.area && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{p.area} sq ft</Text>
              </View>
            )}
          </View>

          {/* Description snippet */}
          {p.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>
              {p.description}
            </Text>
          ) : null}

          {/* WhatsApp CTA */}
          <Pressable
            style={styles.cardContactBtn}
            onPress={(e) => {
              e.stopPropagation();
              handleWhatsAppProperty(p);
            }}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
            <Text style={styles.cardContactBtnText}>
              Contact {broker.full_name?.split(' ')[0] || 'Broker'}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.brokerHeaderInfo}>
          {broker.profile_photo ? (
            <Image source={{ uri: broker.profile_photo }} style={styles.brokerAvatar} />
          ) : (
            <View style={styles.brokerAvatarPlaceholder}>
              <Text style={styles.brokerAvatarInitials}>
                {broker.full_name?.[0]?.toUpperCase() || 'B'}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.brokerName} numberOfLines={1}>
              {broker.full_name}
            </Text>
            <Text style={styles.brokerAgency} numberOfLines={1}>
              {broker.agency_name || 'Independent Broker'}
            </Text>
          </View>
        </View>

        {broker.mobile && (
          <Pressable style={styles.callBrokerBtn} onPress={() => handleCall(broker.mobile)}>
            <Ionicons name="call" size={15} color="#FFFFFF" />
            <Text style={styles.callBrokerBtnText}>Call</Text>
          </Pressable>
        )}
      </View>

      {/* Main List */}
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPropertyItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.collectionIntro}>
            <Text style={styles.collectionTitle}>Property Collection</Text>
            <Text style={styles.collectionSubtitle}>
              Handpicked properties selected exclusively for you by{' '}
              <Text style={{ fontWeight: '600', color: '#1E293B' }}>{broker.full_name}</Text>.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Ionicons name="folder-open-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyListTitle}>No properties found</Text>
            <Text style={styles.emptyListSub}>This collection contains no active properties.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
  },
  errorIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  errorSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2563EB',
    borderRadius: 12,
  },
  errorBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  brokerHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    marginRight: 12,
  },
  brokerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  brokerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  brokerAvatarInitials: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
  },
  brokerName: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  brokerAgency: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  callBrokerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  callBrokerBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  collectionIntro: {
    marginBottom: 20,
  },
  collectionTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  collectionSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImageWrapper: {
    height: 190,
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  priceTag: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  priceTagText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardBody: {
    padding: 16,
  },
  cardTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardLocality: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: '#475569',
    textTransform: 'capitalize',
  },
  cardDesc: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  cardContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 11,
    borderRadius: 12,
  },
  cardContactBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyListTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  emptyListSub: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
});
