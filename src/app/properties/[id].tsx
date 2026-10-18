import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import api from '../../lib/api';
import { storage } from '../../lib/storage';
import { useTranslation } from 'react-i18next';
import { formatPrice, safeGoBack } from '../../lib/utils';
import { Fonts } from '../../constants/theme';
import ShareModal from '../../components/ShareModal';
import CollectionModal from '../../components/CollectionModal';
import { getPropertyPreview } from '../../lib/propertyCache';
import { statsStore } from '../../lib/statsStore';

export default function PropertyDetailScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { id, b: shareBrokerId } = useLocalSearchParams<{ id: string; b?: string }>();
  const preview = id ? getPropertyPreview(id) : null;
  const [property, setProperty] = useState<any>(() => {
    if (preview) {
      const copy = { ...preview };
      if (copy.property_images) {
        copy.property_images = [...copy.property_images].sort((a: any, b: any) => (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0));
      }
      return copy;
    }
    return null;
  });
  const [loading, setLoading] = useState(!preview);
  const [fetchingFull, setFetchingFull] = useState(Boolean(preview));
  const [error, setError] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [showColModal, setShowColModal] = useState(false);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [sharingBroker, setSharingBroker] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const videoUrl = property?.property_videos?.[0]?.url || '';
  const videoPlayer = useVideoPlayer(videoUrl);

  useEffect(() => {
    async function init() {
      const uStr = await storage.get('user');
      if (uStr) {
        try {
          const u = JSON.parse(uStr);
          setCurrentUser(u);
          setUserRole(u.role); // 'tenant' or 'broker'
        } catch {}
      }
      fetchProperty();
      if (shareBrokerId) {
        try {
          const { data } = await api.get(`/broker/${shareBrokerId}/public`);
          setSharingBroker(data);
        } catch (e) {
          console.log('Failed to fetch sharing broker info', e);
        }
      }
    }
    init();
  }, [id, shareBrokerId]);

  const fetchProperty = async () => {
    try {
      const { data } = await api.get(`/properties/${id}`);
      // Sort images: cover first
      if (data.property_images) {
        data.property_images.sort((a: any, b: any) => (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0));
      }
      setProperty(data);
    } catch (e) {
      if (!property && !preview) {
        setError('Property not found');
      }
    } finally {
      setLoading(false);
      setFetchingFull(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const endpoint = userRole === 'tenant' ? '/saved/tenant' : '/saved';
      await api.post(endpoint, { property_id: id });
      setSaved(true);
      statsStore.incrementSaved();
    } catch (e) {
      // Mark as saved anyway if it fails (might already be saved)
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    Linking.openURL(`https://wa.me/${waPhone}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Modal visible={!!zoomImg} transparent={true} animationType="fade" onRequestClose={() => setZoomImg(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <Pressable style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }} onPress={() => setZoomImg(null)}>
            <Ionicons name="close" size={32} color="#FFF" />
          </Pressable>
          {zoomImg && (
            <Image
              source={{ uri: zoomImg }}
              style={{ width: '100%', height: '80%' }}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
    );
  }

  if (error || !property) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Property not found</Text>
        <Pressable style={styles.backButton} onPress={() => safeGoBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
        <Modal visible={!!zoomImg} transparent={true} animationType="fade" onRequestClose={() => setZoomImg(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <Pressable style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }} onPress={() => setZoomImg(null)}>
            <Ionicons name="close" size={32} color="#FFF" />
          </Pressable>
          {zoomImg && (
            <Image
              source={{ uri: zoomImg }}
              style={{ width: '100%', height: '80%' }}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
    );
  }

  const images = property.property_images || [];
  const broker = sharingBroker || property.brokers;
  const pricePerSqft = property.area ? `₹${Math.round(property.price / property.area).toLocaleString()}` : '—';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Image Gallery */}
        <View style={styles.imageGallery}>
          {images.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {images.map((img: any, idx: number) => (
                <Pressable key={idx} onPress={() => setZoomImg(img.url)}>
                  <Image
                    source={{ uri: img.url }}
                    style={[styles.galleryImage, { width, height: width * 0.75 }]}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                  />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.galleryPlaceholder, { width, height: width * 0.75 }]}>
              <Ionicons name="image-outline" size={48} color="#D1D5DB" />
              <Text style={styles.galleryPlaceholderText}>No images available</Text>
            </View>
          )}

          {property.is_dummy && (
            <View style={styles.dummyBadge}>
              <Text style={styles.dummyBadgeText}>DUMMY LISTING</Text>
            </View>
          )}
          
          {images.length > 1 && (
            <View style={styles.imageCountBadge}>
              <Text style={styles.imageCountText}>1 / {images.length}</Text>
            </View>
          )}
        </View>

        {videoUrl ? (
          <View style={styles.videoSection}>
            <Text style={styles.sectionTitle}>{t('property.walkthroughVideo')}</Text>
            <VideoView
              style={styles.videoPlayer}
              player={videoPlayer}
              contentFit="contain"
              nativeControls
              allowsPictureInPicture={false}
            />
          </View>
        ) : null}

        <View style={styles.content}>
          {/* Main Info */}
          <View style={styles.mainInfo}>
            {property.project_name ? <Text style={styles.projectName}>{property.project_name}</Text> : null}
            <Text style={styles.title}>{property.title}</Text>
            <Text style={styles.locality}>{property.locality} • {property.city}</Text>
            
            <Text style={styles.price}>{formatPrice(property.price)}</Text>

            <View style={styles.tagsContainer}>
              <Text style={[styles.tag, styles.tagType]}>{t(`enums.propertyTypes.${property.type}`, { defaultValue: property.type })}</Text>
              {property.listing_type && <Text style={[styles.tag, styles.tagListingType]}>{t(`enums.listingTypes.${property.listing_type}`, { defaultValue: property.listing_type })}</Text>}
              {property.bhk && <Text style={styles.tag}>{property.bhk} {t('property.bhk')}</Text>}
              <Text style={styles.tag}>{property.area} {t('property.sqFt')}</Text>
              
              <Text style={[styles.tag, 
                property.status === 'active' ? styles.tagStatusActive : 
                property.status === 'sold' ? styles.tagStatusSold : styles.tagStatusDefault
              ]}>
                {t(`enums.status.${property.status}`, { defaultValue: property.status })}
              </Text>
            </View>
          </View>


          {/* Amenities */}
          {property.amenities && property.amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('property.amenities')}</Text>
              <View style={styles.amenitiesGrid}>
                {property.amenities.map((item: string, idx: number) => (
                  <View key={idx} style={styles.amenityChip}>
                    <Text style={styles.amenityChipText}>{t(`enums.amenities.${item}`, { defaultValue: item })}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Details Grid */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('property.details')}</Text>
            <View style={styles.detailsGrid}>
              {[
                [t('property.project'), property.project_name || '—'],
                [t('property.listingType'), property.listing_type ? t(`enums.listingTypes.${property.listing_type}`, { defaultValue: property.listing_type }) : '—'],
                [t('property.propertyType'), t(`enums.propertyTypes.${property.type}`, { defaultValue: property.type })],
                [t('property.city'), property.city],
                [t('property.locality'), property.locality],
                [t('property.area'), `${property.area} ${t('property.sqFt')}`],
                [t('property.bhk'), property.bhk || '—'],
                [t('property.washrooms'), property.washrooms || '—'],
                [t('property.floor'), property.floor !== null && property.floor !== undefined ? (property.floor === 0 ? t('property.groundFloor') : property.floor) : '—'],
                [t('property.priceSqft'), pricePerSqft]
              ].map(([label, value], idx) => (
                <View key={idx} style={styles.detailItem}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
          
          {/* Actions */}
          {!shareBrokerId && (
            <View style={[styles.section, styles.actionsCol]}>
              <Pressable 
                style={[styles.saveButton, saved && styles.saveButtonActive]} 
                onPress={handleSave} 
                disabled={saving || saved}
              >
                <Ionicons name={saved ? "checkmark-circle" : "heart-outline"} size={20} color={saved ? "#15803D" : "#FFFFFF"} />
                <Text style={[styles.saveButtonText, saved && styles.saveButtonTextActive]}>
                  {saved ? t('property.saved', { defaultValue: 'Saved' }) : saving ? t('property.saving', { defaultValue: 'Saving...' }) : t('property.saveProperty', { defaultValue: 'Save Property' })}
                </Text>
              </Pressable>

              <Pressable 
                style={styles.collectionButton} 
                onPress={() => setShowColModal(true)} 
              >
                <Ionicons name="albums-outline" size={20} color="#2563EB" />
                <Text style={styles.collectionButtonText}>Add to Collection</Text>
              </Pressable>

              {userRole === 'broker' && (
                <Pressable 
                  style={styles.shareButton} 
                  onPress={() => setShowShareModal(true)} 
                >
                  <Ionicons name="share-social-outline" size={20} color="#2563EB" />
                  <Text style={styles.shareButtonText}>{t('share.shareWithClient', { defaultValue: 'Share with Client' })}</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Broker Card */}
          {broker && (
            <View style={styles.brokerCard}>
              <Text style={styles.brokerCardTitle}>{shareBrokerId ? t('property.sharedBy') : t('property.listedBy')}</Text>
              
              <View style={styles.brokerInfo}>
                {broker.profile_photo ? (
                  <Image
                    source={{ uri: broker.profile_photo }}
                    style={styles.brokerImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                  />
                ) : (
                  <View style={styles.brokerImagePlaceholder}>
                    <Text style={styles.brokerInitials}>{broker.full_name?.[0]}</Text>
                  </View>
                )}
                <View style={styles.brokerDetails}>
                  <Text style={styles.brokerName}>{broker.full_name}</Text>
                  {broker.agency_name && <Text style={styles.brokerAgency}>{broker.agency_name}</Text>}
                  {broker.experience > 0 && <Text style={styles.brokerExp}>{broker.experience} {t('property.yearsExperience')}</Text>}
                </View>
              </View>

              {broker.mobile && (
                <View style={styles.contactActions}>
                  <Pressable style={styles.callButton} onPress={() => handleCall(broker.mobile)}>
                    <Ionicons name="call" size={16} color="#FFFFFF" />
                    <Text style={styles.callButtonText}>{t('property.callBroker')}</Text>
                  </Pressable>
                  <Pressable style={styles.waButton} onPress={() => handleWhatsApp(broker.mobile)}>
                    <Ionicons name="logo-whatsapp" size={16} color="#374151" />
                    <Text style={styles.waButtonText}>{t('common.whatsapp')}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {fetchingFull && !broker && (
            <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={{ fontSize: 13, fontFamily: Fonts.sansMedium, color: '#64748B' }}>
                {t('property.loadingDetails')}
              </Text>
            </View>
          )}

        </View>
      </ScrollView>

      {/* Collection Modal */}
      <CollectionModal
        visible={showColModal}
        propertyIds={[id as string]}
        onClose={() => setShowColModal(false)}
        onSuccess={() => setShowColModal(false)}
      />

      <Modal visible={!!zoomImg} transparent={true} animationType="fade" onRequestClose={() => setZoomImg(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <Pressable style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }} onPress={() => setZoomImg(null)}>
            <Ionicons name="close" size={32} color="#FFF" />
          </Pressable>
          {zoomImg && (
            <Image
              source={{ uri: zoomImg }}
              style={{ width: '100%', height: '80%' }}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          )}
        </View>
      </Modal>
      {/* Share with Client Modal */}
      <ShareModal
        visible={showShareModal}
        selectedIds={[id as string]}
        userId={currentUser?.id}
        onClose={() => setShowShareModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  backButtonText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 40,
    left: 16,
    zIndex: 10,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  imageGallery: {
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  videoSection: {
    padding: 20,
    paddingBottom: 0,
  },
  videoPlayer: {
    width: '100%',
    height: 220,
    marginTop: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
  },
  galleryImage: {
  },
  galleryPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryPlaceholderText: {
    fontFamily: Fonts.sans,
    color: '#9CA3AF',
    marginTop: 8,
    fontSize: 14,
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  imageCountText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dummyBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    backgroundColor: 'rgba(250, 204, 21, 0.9)', // yellow-400
    paddingVertical: 6,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EAB308',
  },
  dummyBadgeText: {
    fontFamily: Fonts.sansBold,
    color: '#713F12', // yellow-900
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  content: {
    padding: 20,
  },
  mainInfo: {
    marginBottom: 24,
  },
  projectName: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 28,
  },
  locality: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  price: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 24,
    fontWeight: '800',
    color: '#1D4ED8',
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    fontFamily: Fonts.sansMedium,
    backgroundColor: '#F3F4F6',
    color: '#4B5563',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  tagType: {
    backgroundColor: '#EFF6FF',
    color: '#1D4ED8',
  },
  tagListingType: {
    backgroundColor: '#FAF5FF',
    color: '#7E22CE',
  },
  tagStatusActive: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  tagStatusSold: {
    backgroundColor: '#EFF6FF',
    color: '#1D4ED8',
  },
  tagStatusDefault: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  section: {
    marginBottom: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sectionTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  description: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  amenityChipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    width: '45%',
  },
  detailLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  detailValue: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    textTransform: 'capitalize',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
  },
  saveButtonActive: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  saveButtonText: {
    fontFamily: Fonts.sansBold,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  saveButtonTextActive: {
    color: '#15803D',
  },
  brokerCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },
  brokerCardTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  brokerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  brokerImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  brokerImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  brokerInitials: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  brokerDetails: {
    flex: 1,
  },
  brokerName: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  brokerAgency: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  brokerExp: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 12,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
  },
  callButtonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  waButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 12,
  },
  waButtonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsCol: {
    flexDirection: 'column',
    gap: 10,
  },
  collectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
  },
  collectionButtonText: {
    fontFamily: Fonts.sansBold,
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '700',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
  },
  shareButtonText: {
    fontFamily: Fonts.sansBold,
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '700',
  },
});
