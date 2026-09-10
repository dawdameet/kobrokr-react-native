import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../../lib/api';
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
  const [loading, setLoading] = useState(false);

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
          <TextInput style={styles.input} value={form.title} onChangeText={(t) => handleChange('title', t)} placeholder="e.g. Spacious 3 BHK Sea View Penthouse" />

          <Text style={styles.label}>Project Name</Text>
          <TextInput style={styles.input} value={form.project_name} onChangeText={(t) => handleChange('project_name', t)} placeholder="e.g. Lodha Belmondo" />

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Sale/Rent *</Text>
              <View style={styles.radioGroup}>
                <Pressable style={[styles.radio, form.listing_type === 'sale' && styles.radioActive]} onPress={() => handleChange('listing_type', 'sale')}>
                  <Text style={[styles.radioText, form.listing_type === 'sale' && styles.radioTextActive]}>Sale</Text>
                </Pressable>
                <Pressable style={[styles.radio, form.listing_type === 'rent' && styles.radioActive]} onPress={() => handleChange('listing_type', 'rent')}>
                  <Text style={[styles.radioText, form.listing_type === 'rent' && styles.radioTextActive]}>Rent</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollChips}>
                {PROPERTY_TYPES.map(t => (
                  <Pressable key={t} style={[styles.chip, form.type === t && styles.chipActive]} onPress={() => handleChange('type', t)}>
                    <Text style={[styles.chipText, form.type === t && styles.chipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
          
          {form.type === 'other' && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>Custom Type *</Text>
              <TextInput style={styles.input} value={form.custom_property_type} onChangeText={(t) => handleChange('custom_property_type', t)} placeholder="e.g. Duplex" />
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
              <TextInput style={styles.input} value={form.locality} onChangeText={(t) => handleChange('locality', t)} placeholder="e.g. Bandra West" />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Price (₹) *</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.price} onChangeText={(t) => handleChange('price', t)} placeholder="e.g. 15000000" />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Area (sq ft) *</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.area} onChangeText={(t) => handleChange('area', t)} placeholder="e.g. 1250" />
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
              <TextInput style={styles.input} keyboardType="numeric" value={form.bhk} onChangeText={(t) => handleChange('bhk', t)} placeholder="e.g. 2" />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Washrooms</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.washrooms} onChangeText={(t) => handleChange('washrooms', t)} placeholder="e.g. 2" />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Floor</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={form.floor} onChangeText={(t) => handleChange('floor', t)} placeholder="e.g. 5" />
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

        {/* Images */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Property Media ({images.length}/5)</Text>
          
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
  scrollChips: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  chipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#6B7280',
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
  }
});
