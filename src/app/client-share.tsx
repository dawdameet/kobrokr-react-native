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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { storage } from '../lib/storage';
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

  // Authentication gate state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<'contact' | 'view_property' | 'general'>('general');

  const redirectUrl = `/client-share?b=${brokerId || ''}&p=${propertyIds || ''}`;

  useEffect(() => {
    async function checkAuth() {
      const uStr = await storage.get('user');
      if (uStr) {
        try {
          setCurrentUser(JSON.parse(uStr));
        } catch {}
      }
    }
    checkAuth();
  }, []);

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
    if (!currentUser) {
      setAuthModalReason('contact');
      setShowAuthModal(true);
      return;
    }
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsAppProperty = (p: any) => {
    if (!currentUser) {
      setAuthModalReason('contact');
      setShowAuthModal(true);
      return;
    }
    if (!broker?.mobile) return;
    const cleanPhone = broker.mobile.replace(/\D/g, '');
    const phoneFormatted = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const firstName = broker.full_name?.split(' ')[0] || 'there';
    const message = `Hi ${firstName}, I'm interested in the property: ${p.title} (${p.locality || p.city}).`;
    Linking.openURL(`https://wa.me/${phoneFormatted}?text=${encodeURIComponent(message)}`);
  };

  const handlePropertyCardPress = (p: any) => {
    if (!currentUser) {
      setAuthModalReason('view_property');
      setShowAuthModal(true);
      return;
    }
    router.push(`/properties/${p.id}?b=${brokerId}` as any);
  };

  const navigateToLogin = () => {
    setShowAuthModal(false);
    router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}` as any);
  };

  const navigateToSignup = () => {
    setShowAuthModal(false);
    router.push(`/signup?redirect=${encodeURIComponent(redirectUrl)}` as any);
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
        onPress={() => handlePropertyCardPress(p)}
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

        <View style={styles.headerRightActions}>
          {currentUser ? (
            <Pressable
              style={styles.homeBtn}
              onPress={() => {
                if (currentUser.role === 'broker') {
                  router.replace('/(broker)/dashboard');
                } else if (currentUser.role === 'tenant') {
                  router.replace('/(tenant)/dashboard');
                } else {
                  router.replace('/');
                }
              }}
            >
              <Ionicons name="home" size={15} color="#2563EB" />
              <Text style={styles.homeBtnText}>Home</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.loginHeaderBtn}
              onPress={navigateToLogin}
            >
              <Ionicons name="log-in-outline" size={15} color="#FFFFFF" />
              <Text style={styles.loginHeaderBtnText}>Log In</Text>
            </Pressable>
          )}

          {broker.mobile && (
            <Pressable style={styles.callBrokerBtn} onPress={() => handleCall(broker.mobile)}>
              <Ionicons name="call" size={14} color="#FFFFFF" />
              <Text style={styles.callBrokerBtnText}>Call</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Main List */}
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPropertyItem}
        contentContainerStyle={[
          styles.listContent,
          !currentUser && { paddingBottom: 110 }
        ]}
        ListHeaderComponent={
          <View style={styles.collectionIntro}>
            <Text style={styles.collectionTitle}>Property Collection</Text>
            <Text style={styles.collectionSubtitle}>
              Handpicked properties selected exclusively for you by{' '}
              <Text style={{ fontWeight: '600', color: '#1E293B' }}>{broker.full_name}</Text>.
            </Text>

            {/* Guest Banner when not logged in */}
            {!currentUser && (
              <View style={styles.guestBanner}>
                <View style={styles.guestBannerHeader}>
                  <Ionicons name="person-circle-outline" size={20} color="#2563EB" />
                  <Text style={styles.guestBannerTitle}>Viewing as Guest</Text>
                </View>
                <Text style={styles.guestBannerText}>
                  Sign in or create a free account to unlock full details, inspect layouts, and chat with {broker.full_name?.split(' ')[0]}.
                </Text>
                <View style={styles.guestBannerActions}>
                  <Pressable style={styles.guestBannerLoginBtn} onPress={navigateToLogin}>
                    <Text style={styles.guestBannerLoginText}>Log In</Text>
                  </Pressable>
                  <Pressable style={styles.guestBannerSignupBtn} onPress={navigateToSignup}>
                    <Text style={styles.guestBannerSignupText}>Sign Up</Text>
                  </Pressable>
                </View>
              </View>
            )}
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

      {/* Persistent Bottom Bar for Guest Users */}
      {!currentUser && (
        <View style={styles.floatingBottomAuth}>
          <View style={styles.floatingBottomAuthContent}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.floatingAuthTitle}>Want to connect?</Text>
              <Text style={styles.floatingAuthSubtitle} numberOfLines={1}>
                Sign in to contact {broker.full_name?.split(' ')[0]}
              </Text>
            </View>
            <Pressable
              style={styles.floatingAuthBtn}
              onPress={() => {
                setAuthModalReason('contact');
                setShowAuthModal(true);
              }}
            >
              <Text style={styles.floatingAuthBtnText}>Log In / Sign Up</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Auth Modal / Bottom Sheet */}
      <Modal
        visible={showAuthModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAuthModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropPressable} onPress={() => setShowAuthModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalIconCircle}>
              <Ionicons
                name={authModalReason === 'contact' ? 'chatbubble-ellipses-outline' : 'lock-closed-outline'}
                size={30}
                color="#2563EB"
              />
            </View>

            <Text style={styles.modalTitle}>
              {authModalReason === 'contact'
                ? `Connect with ${broker.full_name?.split(' ')[0] || 'Broker'}`
                : 'Sign In to View Property'}
            </Text>

            <Text style={styles.modalSubtitle}>
              {authModalReason === 'contact'
                ? `Please sign in or create a free account to message ${broker.full_name}, make calls, or schedule viewings.`
                : `Create a free account or log in to view full property specifications, photo galleries, and broker contact options.`}
            </Text>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalPrimaryBtn} onPress={navigateToLogin}>
                <Text style={styles.modalPrimaryBtnText}>Log In to Continue</Text>
              </Pressable>

              <Pressable style={styles.modalSecondaryBtn} onPress={navigateToSignup}>
                <Text style={styles.modalSecondaryBtnText}>Create Free Account</Text>
              </Pressable>

              <Pressable style={styles.modalDismissBtn} onPress={() => setShowAuthModal(false)}>
                <Text style={styles.modalDismissBtnText}>Continue Previewing</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
  },
  homeBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '700',
  },
  loginHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  loginHeaderBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
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
  guestBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  guestBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  guestBannerTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
  },
  guestBannerText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#3B82F6',
    lineHeight: 18,
    marginBottom: 10,
  },
  guestBannerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  guestBannerLoginBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  guestBannerLoginText: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  guestBannerSignupBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  guestBannerSignupText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
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
  floatingBottomAuth: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  floatingBottomAuthContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingAuthTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  floatingAuthSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  floatingAuthBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  floatingAuthBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalBackdropPressable: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    alignItems: 'center',
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 16,
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  modalTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  modalActions: {
    width: '100%',
    gap: 10,
  },
  modalPrimaryBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  modalDismissBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalDismissBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#94A3B8',
  },
});
