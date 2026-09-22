import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Image,
  Share,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { formatPrice } from '../lib/utils';
import { Fonts } from '../constants/theme';

interface ShareModalProps {
  visible: boolean;
  selectedIds: (string | number)[];
  userId?: string | number;
  onClose: () => void;
}

export default function ShareModal({
  visible,
  selectedIds,
  userId,
  onClose,
}: ShareModalProps) {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const isDev = __DEV__;
  const baseUrl = isDev ? 'http://192.168.1.148:5173' : 'https://kobrokr.com';
  const shareLink = `${baseUrl}/client-share?b=${userId || ''}&p=${selectedIds.join(',')}${isDev ? '&dev=1' : ''}`;

  useEffect(() => {
    if (visible && selectedIds.length > 0) {
      fetchPreviewProperties();
    } else {
      setProperties([]);
    }
  }, [visible, selectedIds]);

  const fetchPreviewProperties = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/properties/shared?ids=${selectedIds.join(',')}`);
      setProperties(data || []);
    } catch (err) {
      console.log('Failed to fetch preview properties', err);
    } finally {
      setLoading(false);
    }
  };

  const count = selectedIds.length;
  const shareMessage = `Hi! I've shortlisted ${count} propert${count > 1 ? 'ies' : 'y'} for you to review. Click the link below to view the collection:\n\n${shareLink}`;

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to open WhatsApp', 'Please ensure WhatsApp is installed on your device.');
    });
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        title: 'Shortlisted Properties',
        message: shareMessage,
        url: shareLink,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleCopyLink = async () => {
    try {
      // Use native share sheet for copy or system fallback
      await Share.share({
        message: shareLink,
        url: shareLink,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Share with Client</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{count} {count === 1 ? 'item' : 'items'}</Text>
                </View>
              </View>
              <Text style={styles.subtitle}>
                Your contact info will be shown, holding broker details are hidden.
              </Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </Pressable>
          </View>

          {/* Link Box */}
          <View style={styles.linkBox}>
            <View style={styles.linkRow}>
              <Ionicons name="link-outline" size={16} color="#2563EB" style={{ marginRight: 6 }} />
              <Text style={styles.linkText} numberOfLines={1}>
                {shareLink}
              </Text>
            </View>
            <Pressable style={styles.copyBtn} onPress={handleCopyLink}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color="#2563EB" />
              <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Share Link'}</Text>
            </Pressable>
          </View>

          {/* Preview Section */}
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewHeading}>CLIENT PREVIEW</Text>
              <Text style={styles.previewMeta}>White-labeled view</Text>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.loadingText}>Loading property preview...</Text>
              </View>
            ) : properties.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.previewScroll}
              >
                {properties.map((p) => {
                  const cover =
                    p.property_images?.find((i: any) => i.is_cover)?.url ||
                    p.property_images?.[0]?.url;

                  return (
                    <View key={p.id} style={styles.previewCard}>
                      <View style={styles.previewCardImageContainer}>
                        {cover ? (
                          <Image source={{ uri: cover }} style={styles.previewCardImage} />
                        ) : (
                          <View style={styles.previewCardPlaceholder}>
                            <Ionicons name="image-outline" size={24} color="#CBD5E1" />
                          </View>
                        )}
                        <View style={styles.previewCardPriceBadge}>
                          <Text style={styles.previewCardPrice}>{formatPrice(p.price)}</Text>
                        </View>
                      </View>

                      <View style={styles.previewCardBody}>
                        <Text style={styles.previewCardTitle} numberOfLines={1}>
                          {p.title}
                        </Text>
                        <Text style={styles.previewCardLocality} numberOfLines={1}>
                          {p.locality ? `${p.locality}, ${p.city}` : p.city}
                        </Text>
                        {!!p.area && (
                          <Text style={styles.previewCardArea}>{p.area} sq ft</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.emptyPreviewBox}>
                <Text style={styles.emptyPreviewText}>No properties selected</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <Pressable style={styles.whatsappBtn} onPress={handleWhatsApp}>
              <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
              <Text style={styles.whatsappBtnText}>Send via WhatsApp</Text>
            </Pressable>

            <Pressable style={styles.moreShareBtn} onPress={handleNativeShare}>
              <Ionicons name="share-social-outline" size={18} color="#374151" />
              <Text style={styles.moreShareBtnText}>More Options</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingBottom: 36,
    paddingHorizontal: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  countBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  countBadgeText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginLeft: 8,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  linkRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkText: {
    flex: 1,
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: '#475569',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  copyBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  previewContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 20,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  previewHeading: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  previewMeta: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#94A3B8',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
  },
  emptyPreviewBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPreviewText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#94A3B8',
  },
  previewScroll: {
    gap: 12,
    paddingRight: 4,
  },
  previewCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewCardImageContainer: {
    height: 85,
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  previewCardImage: {
    width: '100%',
    height: '100%',
  },
  previewCardPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  previewCardPriceBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  previewCardPrice: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewCardBody: {
    padding: 8,
  },
  previewCardTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  previewCardLocality: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#64748B',
  },
  previewCardArea: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  actionsContainer: {
    gap: 10,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    borderRadius: 16,
    paddingVertical: 14,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  whatsappBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  moreShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  moreShareBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
});
