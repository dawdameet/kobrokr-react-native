import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Image, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import api from '../../lib/api';
import { storage } from '../../lib/storage';
import { safeGoBack } from '../../lib/utils';
import { Fonts } from '../../constants/theme';

const PROPERTY_TYPES = ["apartment", "house", "villa", "plot", "office", "shop", "warehouse", "other"];
const ALL_CITIES = ['Mumbai', 'Pune', 'Delhi NCR', 'Bangalore', 'Hyderabad'];
const PREDEFINED_AMENITIES = ['Parking', 'Gym', 'Swimming Pool', 'Security', 'Club House', 'Power Backup', 'Lift', 'Park', 'Vastu Compliant', 'Internet/Wi-Fi'];

export default function AddPropertyScreen() {
  const [form, setForm] = useState({
    title: '', project_name: '', listing_type: 'sale', type: 'apartment', custom_property_type: '',
    city: 'Mumbai', locality: '', price: '', area: '', unit_type: 'BHK', bhk: '', washrooms: '',
    floor: '', description: '', amenities: [] as string[]
  });
  
  const [images, setImages] = useState<any[]>([]);
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    async function loadUser() {
      const uStr = await storage.get('user');
      if (uStr) {
        try {
          setCurrentUser(JSON.parse(uStr));
        } catch {}
      }
    }
    loadUser();
  }, []);

  const isPro = ['individual', 'enterprise', 'premium'].includes(currentUser?.plan?.toLowerCase?.() || '');

  const handleChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleAmenity = (amenity: string) => {
    setForm(prev => {
      if (prev.amenities.includes(amenity)) {
        return { ...prev, amenities: prev.amenities.filter(a => a !== amenity) };
      }
      return { ...prev, amenities: [...prev.amenities, amenity] };
    });
  };

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5 - images.length,
        quality: 0.7, // Good built-in compression
      });

      if (!result.canceled) {
        setImages(prev => [...prev, ...result.assets]);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handlePickVideo = async () => {
    if (!isPro) {
      Alert.alert(
        'Pro Feature 🚀',
        'Video walkthroughs are exclusively available for Pro members.\n\nBoost your property inquiries and get featured in Discovery Mode by upgrading your plan on Kobrokr.',
        [
          { text: 'Got it', style: 'cancel' },
          {
            text: 'View Plans',
            onPress: async () => {
              const savedCode = await storage.get('applied_referral_code');
              const url = savedCode
                ? `https://kobrokr.com/plans?ref=${encodeURIComponent(savedCode)}`
                : 'https://kobrokr.com/plans';
              try {
                await WebBrowser.openBrowserAsync(url);
              } catch {
                Linking.openURL(url);
              }
            },
          },
        ]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
          Alert.alert('Video Too Large', 'Please select a video under 50MB.');
          return;
        }
        setVideo(asset);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  const removeVideo = () => {
    setVideo(null);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.locality || !form.price || !form.area) {
      Alert.alert('Missing Fields', 'Please fill in all required fields (marked with *).');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: form.title,
        project_name: form.project_name,
        listing_type: form.listing_type,
        type: form.type,
        custom_property_type: form.type === 'other' ? form.custom_property_type : undefined,
        city: form.city,
        locality: form.locality,
        price: parseInt(form.price, 10),
        area: parseFloat(form.area),
        bhk: form.bhk ? parseInt(form.bhk, 10) : null,
        washrooms: form.washrooms ? parseInt(form.washrooms, 10) : null,
        floor: form.floor ? parseInt(form.floor, 10) : null,
        description: form.description,
        unit_type: form.unit_type,
        amenities: form.amenities,
      };

      // 1. Create listing
      const { data } = await api.post('/properties', payload);
      const propertyId = data.id;

      // 2. Upload images if any
      if (images.length > 0) {
        const formData = new FormData();
        images.forEach((img, i) => {
          const filename = img.fileName || img.uri.split('/').pop() || `image${i}.jpg`;
          const ext = filename.split('.').pop()?.toLowerCase();
          const mimeType = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
          
          formData.append('images', {
            uri: img.uri,
            name: filename,
            type: mimeType,
          } as any);
        });

        await api.post(`/properties/${propertyId}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // 3. Upload video if any
      if (video) {
        const videoData = new FormData();
        const filename = video.fileName || video.uri.split('/').pop() || 'walkthrough.mp4';
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'mov' ? 'video/quicktime' : (ext === 'webm' ? 'video/webm' : 'video/mp4');

        videoData.append('video', {
          uri: video.uri,
          name: filename,
          type: mimeType,
        } as any);

        try {
          await api.post(`/properties/${propertyId}/videos`, videoData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (vidErr) {
          console.error('Video upload failed:', vidErr);
        }
      }

      Alert.alert('Success', 'Property listed successfully!', [
        { text: 'OK', onPress: () => router.push('/(broker)/dashboard') }
      ]);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.response?.data?.error || 'Failed to list property. Check limits or network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>List a Property</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Basic Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Basic Information</Text>
          
          <Text style={styles.label}>Title *</Text>
          <TextInput 
            style={styles.input} 
            value={form.title} 
            onChangeText={(t) => handleChange('title', t)} 
            placeholder="e.g. Spacious 3 BHK Sea View Penthouse" 
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Project Name</Text>
          <TextInput 
            style={styles.input} 
            value={form.project_name} 
            onChangeText={(t) => handleChange('project_name', t)} 
            placeholder="e.g. Lodha Belmondo" 
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Sale/Rent *</Text>
          <View style={[styles.radioGroup, { marginBottom: 14 }]}>
            <Pressable style={[styles.radio, form.listing_type === 'sale' && styles.radioActive]} onPress={() => handleChange('listing_type', 'sale')}>
              <Text style={[styles.radioText, form.listing_type === 'sale' && styles.radioTextActive]}>Sale</Text>
            </Pressable>
            <Pressable style={[styles.radio, form.listing_type === 'rent' && styles.radioActive]} onPress={() => handleChange('listing_type', 'rent')}>
              <Text style={[styles.radioText, form.listing_type === 'rent' && styles.radioTextActive]}>Rent</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Type *</Text>
          <View style={styles.chipsWrap}>
            {PROPERTY_TYPES.map(t => (
              <Pressable key={t} style={[styles.chip, form.type === t && styles.chipActive]} onPress={() => handleChange('type', t)}>
                <Text style={[styles.chipText, form.type === t && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          
          {form.type === 'other' && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>Custom Type *</Text>
              <TextInput 
                style={styles.input} 
                value={form.custom_property_type} 
                onChangeText={(t) => handleChange('custom_property_type', t)} 
                placeholder="e.g. Duplex" 
                placeholderTextColor="#9CA3AF"
              />
            </View>
          )}
        </View>

        {/* Location & Specs */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location & Specifications</Text>

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>City *</Text>
              <View style={[styles.input, styles.inputDisabled]}>
                <Text style={styles.inputText}>Mumbai (Only)</Text>
              </View>
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Locality *</Text>
              <TextInput 
                style={styles.input} 
                value={form.locality} 
                onChangeText={(t) => handleChange('locality', t)} 
                placeholder="e.g. Bandra West" 
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Price (₹) *</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric" 
                value={form.price} 
                onChangeText={(t) => handleChange('price', t)} 
                placeholder="e.g. 15000000" 
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Area (sq ft) *</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric" 
                value={form.area} 
                onChangeText={(t) => handleChange('area', t)} 
                placeholder="e.g. 1250" 
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Config *</Text>
              <View style={styles.radioGroup}>
                <Pressable style={[styles.radio, form.unit_type === 'BHK' && styles.radioActive]} onPress={() => handleChange('unit_type', 'BHK')}>
                  <Text style={[styles.radioText, form.unit_type === 'BHK' && styles.radioTextActive]}>BHK</Text>
                </Pressable>
                <Pressable style={[styles.radio, form.unit_type === 'RK' && styles.radioActive]} onPress={() => handleChange('unit_type', 'RK')}>
                  <Text style={[styles.radioText, form.unit_type === 'RK' && styles.radioTextActive]}>RK</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Count *</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric" 
                value={form.bhk} 
                onChangeText={(t) => handleChange('bhk', t)} 
                placeholder="e.g. 2" 
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Washrooms</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric" 
                value={form.washrooms} 
                onChangeText={(t) => handleChange('washrooms', t)} 
                placeholder="e.g. 2" 
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Floor</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric" 
                value={form.floor} 
                onChangeText={(t) => handleChange('floor', t)} 
                placeholder="e.g. 5" 
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        </View>

        {/* Details & Amenities */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details & Amenities</Text>
          
          <Text style={styles.label}>Description</Text>
          <TextInput 
            style={[styles.input, styles.textArea]} 
            value={form.description} 
            onChangeText={(t) => handleChange('description', t)} 
            placeholder="Detail outstanding features, proximity to key locations..." 
            placeholderTextColor="#9CA3AF"
            multiline 
            numberOfLines={4} 
            textAlignVertical="top"
          />

          <Text style={styles.label}>Amenities</Text>
          <View style={styles.amenityGrid}>
            {PREDEFINED_AMENITIES.map(a => {
              const isSelected = form.amenities.includes(a);
              return (
                <Pressable key={a} style={[styles.amenityItem, isSelected && styles.amenityItemActive]} onPress={() => toggleAmenity(a)}>
                  <Text style={[styles.amenityText, isSelected && styles.amenityTextActive]}>{a}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Walkthrough Video */}
        <View style={styles.card}>
          <View style={styles.videoHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="videocam" size={18} color="#2563EB" />
              <Text style={styles.cardTitleNoMargin}>Walkthrough Video</Text>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            </View>
          </View>
          <Text style={styles.videoSubtext}>
            Featured in Discovery Mode feed. Boosts buyer inquiries up to 2x.
          </Text>

          {video ? (
            <View style={styles.videoSelectedContainer}>
              <View style={styles.videoIconCircle}>
                <Ionicons name="videocam-outline" size={24} color="#2563EB" />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.videoFileName} numberOfLines={1}>
                  {video.fileName || 'Walkthrough Video'}
                </Text>
                <Text style={styles.videoFileSize}>
                  {video.fileSize ? `${(video.fileSize / (1024 * 1024)).toFixed(1)} MB • ` : ''}Ready to upload
                </Text>
              </View>
              <Pressable onPress={removeVideo} style={styles.removeVideoBtn}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.addVideoBtn} onPress={handlePickVideo}>
              <View style={styles.videoAddIconCircle}>
                <Ionicons name="videocam-outline" size={26} color="#2563EB" />
              </View>
              <Text style={styles.addVideoText}>Upload Walkthrough Video</Text>
              <Text style={styles.addVideoSub}>Max 50MB (MP4, MOV, WEBM)</Text>
              {!isPro && (
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={12} color="#D97706" />
                  <Text style={styles.lockBadgeText}>Tap to see Pro benefits</Text>
                </View>
              )}
            </Pressable>
          )}
        </View>

        {/* Images */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Property Photos ({images.length}/5)</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
            {images.map((img, idx) => (
              <View key={idx} style={styles.imageWrapper}>
                <Image source={{ uri: img.uri }} style={styles.thumbnail} />
                <Pressable style={styles.removeImage} onPress={() => removeImage(idx)}>
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
            
            {images.length < 5 && (
              <Pressable style={styles.addImageBtn} onPress={pickImages}>
                <Ionicons name="images-outline" size={32} color="#9CA3AF" />
                <Text style={styles.addImageText}>Add Photos</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.submitButton, loading && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Publish Listing</Text>
          )}
        </Pressable>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  cardTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  flex1: {
    flex: 1,
  },
  label: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
  },
  input: {
    fontFamily: Fonts.sans,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 12,
  },
  inputText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#6B7280',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
  },
  textArea: {
    height: 100,
  },
  radioGroup: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
  },
  radio: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  radioActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  radioText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  radioTextActive: {
    fontFamily: Fonts.sansSemiBold,
    color: '#111827',
    fontWeight: '600',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  chipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#4B5563',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    fontFamily: Fonts.sansSemiBold,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  amenityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  amenityItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  amenityText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#4B5563',
  },
  amenityTextActive: {
    fontFamily: Fonts.sansSemiBold,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  imageScroll: {
    flexDirection: 'row',
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginRight: 12,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeImage: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 4,
  },
  addImageBtn: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  addImageText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  videoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitleNoMargin: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  proBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  videoSubtext: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  addVideoBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  videoAddIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  addVideoText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  addVideoSub: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#9CA3AF',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 8,
  },
  lockBadgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: '#B45309',
    fontWeight: '600',
  },
  videoSelectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
  },
  videoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  videoFileName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#166534',
    fontWeight: '600',
  },
  videoFileSize: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#15803D',
  },
  removeVideoBtn: {
    padding: 8,
  }
});
