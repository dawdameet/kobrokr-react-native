import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image, Linking, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { storage } from '../../lib/storage';
import { formatPrice } from '../../lib/utils';
import { Fonts } from '../../constants/theme';

export default function PropertyDetailScreen() {
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [showColModal, setShowColModal] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [colLoading, setColLoading] = useState(false);
  const [isCreatingCol, setIsCreatingCol] = useState(false);
  const [newColName, setNewColName] = useState('');

  useEffect(() => {
    async function init() {
      const uStr = await storage.get('user');
      if (uStr) {
        const u = JSON.parse(uStr);
        setUserRole(u.role); // 'tenant' or 'broker'
      }
      fetchProperty();
    }
    init();
  }, [id]);

  const fetchProperty = async () => {
    try {
      const { data } = await api.get(`/properties/${id}`);
      // Sort images: cover first
      if (data.property_images) {
        data.property_images.sort((a: any, b: any) => (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0));
      }
      setProperty(data);
    } catch (e) {
      setError('Property not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const endpoint = userRole === 'tenant' ? '/saved/tenant' : '/saved';
      await api.post(endpoint, { property_id: id });
      setSaved(true);
    } catch (e) {
      // Mark as saved anyway if it fails (might already be saved)
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const openColModal = async () => {
    setShowColModal(true);
    setColLoading(true);
    try {
      const { data } = await api.get('/collections');
      setCollections(data);
    } catch (e) {
      console.log(e);
    } finally {
      setColLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newColName.trim()) return;
    try {
      const { data } = await api.post('/collections', { name: newColName });
      setCollections(prev => [...prev, data]);
      setNewColName('');
      setIsCreatingCol(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to create collection');
    }
  };

  const handleAddToCollection = async (colId: number) => {
    try {
      await api.post(`/collections/${colId}/properties`, { property_ids: [id] });
      setShowColModal(false);
      Alert.alert('Success', 'Property added to collection!');
    } catch (e) {
      Alert.alert('Error', 'Failed to add to collection');
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
      </SafeAreaView>
    );
  }

  if (error || !property) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Property not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const images = property.property_images || [];
  const broker = property.brokers;
  const pricePerSqft = property.area ? `₹${Math.round(property.price / property.area).toLocaleString()}` : '—';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Image Gallery */}
        <View style={styles.imageGallery}>
          {images.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {images.map((img: any, idx: number) => (
                <Image key={idx} source={{ uri: img.url }} style={[styles.galleryImage, { width, height: width * 0.75 }]} />
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

        <View style={styles.content}>
          {/* Main Info */}
          <View style={styles.mainInfo}>
            {property.project_name ? <Text style={styles.projectName}>{property.project_name}</Text> : null}
            <Text style={styles.title}>{property.title}</Text>
            <Text style={styles.locality}>{property.locality} • {property.city}</Text>
            
            <Text style={styles.price}>{formatPrice(property.price)}</Text>

            <View style={styles.tagsContainer}>
              <Text style={[styles.tag, styles.tagType]}>{property.type}</Text>
              {property.listing_type && <Text style={[styles.tag, styles.tagListingType]}>{property.listing_type}</Text>}
              {property.bhk && <Text style={styles.tag}>{property.bhk} BHK</Text>}
              <Text style={styles.tag}>{property.area} sq ft</Text>
              
              <Text style={[styles.tag, 
                property.status === 'active' ? styles.tagStatusActive : 
                property.status === 'sold' ? styles.tagStatusSold : styles.tagStatusDefault
              ]}>
                {property.status}
              </Text>
            </View>
          </View>

          {/* Description */}
          {property.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Property Description</Text>
              <Text style={styles.description}>{property.description}</Text>
            </View>
          )}

          {/* Amenities */}
          {property.amenities && property.amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenitiesGrid}>
                {property.amenities.map((item: string, idx: number) => (
                  <View key={idx} style={styles.amenityChip}>
                    <Text style={styles.amenityChipText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Details Grid */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailsGrid}>
              {[
                ['Project', property.project_name || '—'],
                ['Listing Type', property.listing_type || '—'],
                ['Property Type', property.type],
                ['City', property.city],
                ['Locality', property.locality],
                ['Area', `${property.area} sq ft`],
                ['BHK', property.bhk || '—'],
                ['Washrooms', property.washrooms || '—'],
                ['Floor', property.floor !== null && property.floor !== undefined ? (property.floor === 0 ? 'Ground' : property.floor) : '—'],
                ['Price / sq ft', pricePerSqft]
              ].map(([label, value], idx) => (
                <View key={idx} style={styles.detailItem}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
          
          {/* Actions */}
          <View style={[styles.section, styles.actionsRow]}>
            <Pressable 
              style={[styles.saveButton, saved && styles.saveButtonActive, { flex: 1 }]} 
              onPress={handleSave} 
              disabled={saving || saved}
            >
              <Ionicons name={saved ? "checkmark-circle" : "heart-outline"} size={20} color={saved ? "#15803D" : "#FFFFFF"} />
              <Text style={[styles.saveButtonText, saved && styles.saveButtonTextActive]}>
                {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
            <Pressable 
              style={[styles.saveButton, { flex: 1, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }]} 
              onPress={openColModal} 
            >
              <Ionicons name="folder-open-outline" size={20} color="#1D4ED8" />
              <Text style={[styles.saveButtonText, { color: '#1D4ED8' }]}>Collect</Text>
            </Pressable>
          </View>

          {/* Broker Card */}
          {broker && (
            <View style={styles.brokerCard}>
              <Text style={styles.brokerCardTitle}>Listed by</Text>
              
              <View style={styles.brokerInfo}>
                {broker.profile_photo ? (
                  <Image source={{ uri: broker.profile_photo }} style={styles.brokerImage} />
                ) : (
                  <View style={styles.brokerImagePlaceholder}>
                    <Text style={styles.brokerInitials}>{broker.full_name?.[0]}</Text>
                  </View>
                )}
                <View style={styles.brokerDetails}>
                  <Text style={styles.brokerName}>{broker.full_name}</Text>
                  {broker.agency_name && <Text style={styles.brokerAgency}>{broker.agency_name}</Text>}
                  {broker.experience > 0 && <Text style={styles.brokerExp}>{broker.experience} years experience</Text>}
                </View>
              </View>

              {broker.mobile && (
                <View style={styles.contactActions}>
                  <Pressable style={styles.callButton} onPress={() => handleCall(broker.mobile)}>
                    <Ionicons name="call" size={16} color="#FFFFFF" />
                    <Text style={styles.callButtonText}>Call Broker</Text>
                  </Pressable>
                  <Pressable style={styles.waButton} onPress={() => handleWhatsApp(broker.mobile)}>
                    <Ionicons name="logo-whatsapp" size={16} color="#374151" />
                    <Text style={styles.waButtonText}>WhatsApp</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

        </View>
      </ScrollView>

      {/* Collection Modal */}
      <Modal visible={showColModal} transparent animationType="slide" onRequestClose={() => setShowColModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Collection</Text>
              <Pressable onPress={() => setShowColModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>

            {colLoading ? (
              <ActivityIndicator size="large" color="#2563EB" style={{ marginVertical: 32 }} />
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {collections.length > 0 ? (
                  collections.map(col => {
                    const isFull = col.property_ids?.length >= 5;
                    return (
                      <View key={col.id} style={styles.colListItem}>
                        <View>
                          <Text style={styles.colListTitle}>{col.name}</Text>
                          <Text style={styles.colListMeta}>{col.property_ids?.length || 0} / 5 properties</Text>
                        </View>
                        <Pressable 
                          style={[styles.colAddBtn, isFull && styles.colAddBtnDisabled]} 
                          disabled={isFull}
                          onPress={() => handleAddToCollection(col.id)}
                        >
                          <Text style={[styles.colAddBtnText, isFull && styles.colAddBtnTextDisabled]}>
                            {isFull ? 'Full' : 'Add'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyColText}>No collections yet.</Text>
                )}

                {isCreatingCol ? (
                  <View style={styles.createColBox}>
                    <Text style={styles.createColLabel}>Collection Name</Text>
                    <TextInput 
                      style={styles.createColInput}
                      value={newColName}
                      onChangeText={setNewColName}
                      placeholder="e.g. Luxury Finds"
                      autoFocus
                    />
                    <View style={styles.createColActions}>
                      <Pressable style={styles.createColCancelBtn} onPress={() => setIsCreatingCol(false)}>
                        <Text style={styles.createColCancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable style={styles.createColSaveBtn} onPress={handleCreateCollection} disabled={!newColName.trim()}>
                        <Text style={styles.createColSaveText}>Create</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable style={styles.newColBtn} onPress={() => setIsCreatingCol(true)}>
                    <Text style={styles.newColBtnText}>+ Create New Collection</Text>
                  </Pressable>
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  galleryImage: {
    resizeMode: 'cover',
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
    borderRadius: 12,
  },
  saveButtonActive: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  saveButtonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalScroll: {
    maxHeight: 400,
  },
  colListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  colListTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  colListMeta: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  colAddBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  colAddBtnDisabled: {
    backgroundColor: '#F3F4F6',
  },
  colAddBtnText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#1D4ED8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  colAddBtnTextDisabled: {
    fontFamily: Fonts.sansSemiBold,
    color: '#9CA3AF',
  },
  emptyColText: {
    fontFamily: Fonts.sans,
    textAlign: 'center',
    color: '#6B7280',
    paddingVertical: 24,
  },
  newColBtn: {
    marginTop: 16,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
  },
  newColBtnText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#4B5563',
    fontWeight: 'bold',
  },
  createColBox: {
    marginTop: 16,
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  createColLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  createColInput: {
    fontFamily: Fonts.sans,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  createColActions: {
    flexDirection: 'row',
    gap: 8,
  },
  createColCancelBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  createColCancelText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#374151',
    fontWeight: 'bold',
  },
  createColSaveBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  createColSaveText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontWeight: 'bold',
  }
});
