import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Linking,
  Share,
  Platform,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Fonts } from '../constants/theme';
import { formatPrice } from '../lib/utils';
import api from '../lib/api';
import { storage } from '../lib/storage';

interface DiscoverVideoCardProps {
  property: any;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  height: number;
}

export default function DiscoverVideoCard({
  property,
  isActive,
  isMuted,
  onToggleMute,
  height,
}: DiscoverVideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const lastTapRef = useRef<number>(0);

  const videoUrl = property.property_videos?.[0]?.url;
  const coverImage = property.property_images?.find((img: any) => img.is_cover)?.url || property.property_images?.[0]?.url;
  const broker = property.brokers;

  // Video player configuration
  const player = useVideoPlayer(videoUrl || '', (p) => {
    p.loop = true;
    p.muted = isMuted;
    if (isActive) {
      p.play();
    }
  });

  // Manage playback based on scroll viewability
  useEffect(() => {
    if (!player) return;
    if (isActive) {
      player.play();
      setIsPlaying(true);
    } else {
      player.pause();
      setIsPlaying(false);
    }
  }, [isActive, player]);

  // Manage mute state
  useEffect(() => {
    if (!player) return;
    player.muted = isMuted;
  }, [isMuted, player]);

  // Check saved state initially
  useEffect(() => {
    let isMounted = true;
    async function checkSaved() {
      try {
        const userStr = await storage.get('user');
        if (!userStr) return;
        const u = JSON.parse(userStr);
        const endpoint = u.role === 'tenant' ? '/saved/tenant' : '/saved';
        const { data } = await api.get(endpoint);
        if (isMounted && Array.isArray(data)) {
          const match = data.some((s: any) => s.properties?.id === property.id || s.property_id === property.id);
          setIsSaved(match);
        }
      } catch (e) {
        // silent fail on check
      }
    }
    checkSaved();
    return () => { isMounted = false; };
  }, [property.id]);

  const togglePlayPause = () => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 700);
  };

  const handleCardPress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (lastTapRef.current && now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      // Double tap -> Save with animation
      triggerLike();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now) {
          togglePlayPause();
          lastTapRef.current = 0;
        }
      }, DOUBLE_PRESS_DELAY);
    }
  };

  const triggerLike = async () => {
    setShowHeartAnim(true);
    setTimeout(() => setShowHeartAnim(false), 900);
    if (!isSaved) {
      handleToggleSave();
    }
  };

  const handleToggleSave = async () => {
    try {
      const userStr = await storage.get('user');
      const u = userStr ? JSON.parse(userStr) : null;
      const endpoint = u?.role === 'tenant' ? '/saved/tenant' : '/saved';
      if (isSaved) {
        setIsSaved(false);
        await api.delete(`${endpoint}/${property.id}`);
      } else {
        setIsSaved(true);
        await api.post(endpoint, { property_id: property.id });
      }
    } catch (e) {
      // Revert if failed
      setIsSaved(prev => !prev);
    }
  };

  const handleShare = async () => {
    try {
      const isDev = __DEV__;
      const devWebUrl = process.env.EXPO_PUBLIC_WEB_URL || (process.env.EXPO_PUBLIC_API_URL ? process.env.EXPO_PUBLIC_API_URL.replace(/:\d+$/, ':5173') : 'http://localhost:5173');
      const baseUrl = isDev ? devWebUrl : 'https://kobrokr.com';
      const brokerId = property.broker_id || broker?.id || '';
      const shareLink = `${baseUrl}/client-share?b=${brokerId}&p=${property.id}${isDev ? '&dev=1' : ''}`;

      const shareMessage = `Check out this property walkthrough on Kobrokr:\n${property.title} in ${property.locality ? property.locality + ', ' : ''}${property.city} - ${formatPrice(property.price)}\n\nWatch walkthrough video & open in app:\n${shareLink}`;

      await Share.share(
        Platform.OS === 'ios'
          ? {
              title: property.title || 'Property Walkthrough on Kobrokr',
              message: shareMessage,
              url: shareLink,
            }
          : {
              title: property.title || 'Property Walkthrough on Kobrokr',
              message: shareMessage,
            }
      );
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  const handleCall = () => {
    if (!broker?.mobile) return;
    Linking.openURL(`tel:${broker.mobile}`);
  };

  const handleWhatsApp = () => {
    if (!broker?.mobile) return;
    const clean = broker.mobile.replace(/\D/g, '');
    const phone = clean.length === 10 ? `91${clean}` : clean;
    const text = encodeURIComponent(`Hi ${broker.full_name || ''}, I am interested in your property on kobrokr: ${property.title} (${formatPrice(property.price)}). Is it available?`);
    Linking.openURL(`https://wa.me/${phone}?text=${text}`);
  };

  return (
    <View style={[styles.container, { height }]}>
      {/* Background: Video or Fallback Image */}
      <Pressable style={styles.mediaContainer} onPress={handleCardPress}>
        {videoUrl ? (
          <VideoView
            style={StyleSheet.absoluteFill}
            player={player}
            allowsPictureInPicture={false}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <Image
            source={{ uri: coverImage || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800' }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        )}

        {/* Play / Pause Indicator */}
        {showPlayIcon && (
          <View style={styles.centerIconWrapper}>
            <View style={styles.centerIconBg}>
              <Ionicons
                name={isPlaying ? 'play' : 'pause'}
                size={38}
                color="#111827"
              />
            </View>
          </View>
        )}

        {/* Double-Tap Heart Burst */}
        {showHeartAnim && (
          <View style={styles.centerIconWrapper}>
            <Ionicons name="heart" size={90} color="#EF4444" />
          </View>
        )}
      </Pressable>

      {/* Top Controls: Sound Mute Toggle */}
      {videoUrl && (
        <View style={styles.topBar}>
          <Pressable style={styles.muteButton} onPress={onToggleMute}>
            <Ionicons
              name={isMuted ? 'volume-mute' : 'volume-high'}
              size={18}
              color="#111827"
            />
          </Pressable>
        </View>
      )}

      {/* Right Sidebar Actions */}
      <View style={styles.rightRail}>
        {/* Like / Save */}
        <Pressable style={styles.actionBtn} onPress={handleToggleSave}>
          <View style={[styles.actionIconCircle, isSaved && styles.actionIconSaved]}>
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={22}
              color={isSaved ? '#EF4444' : '#111827'}
            />
          </View>
          <Text style={styles.actionLabel}>{isSaved ? 'Saved' : 'Save'}</Text>
        </Pressable>

        {/* Share */}
        <Pressable style={styles.actionBtn} onPress={handleShare}>
          <View style={styles.actionIconCircle}>
            <Ionicons name="share-social-outline" size={20} color="#111827" />
          </View>
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>

        {/* Call Broker */}
        {broker?.mobile && (
          <Pressable style={styles.actionBtn} onPress={handleCall}>
            <View style={[styles.actionIconCircle, styles.callCircle]}>
              <Ionicons name="call" size={18} color="#2563EB" />
            </View>
            <Text style={styles.actionLabel}>Call</Text>
          </Pressable>
        )}

        {/* WhatsApp */}
        {broker?.mobile && (
          <Pressable style={styles.actionBtn} onPress={handleWhatsApp}>
            <View style={[styles.actionIconCircle, styles.whatsappCircle]}>
              <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
            </View>
            <Text style={styles.actionLabel}>WhatsApp</Text>
          </Pressable>
        )}
      </View>

      {/* Bottom Information Layer - Maximized Video View */}
      <View style={styles.bottomInfo}>
        {/* Price & Listing Type Pill */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(property.price)}</Text>
          {property.listing_type && (
            <View style={styles.listingTypeBadge}>
              <Text style={styles.listingTypeText}>
                {property.listing_type === 'sale' ? 'FOR SALE' : 'FOR RENT'}
              </Text>
            </View>
          )}
        </View>

        {/* Specs & Location */}
        <Text style={styles.specsText} numberOfLines={1}>
          {property.bhk ? `${property.bhk} BHK · ` : ''}
          {property.area ? `${property.area} sq ft · ` : ''}
          {property.locality ? `${property.locality}, ` : ''}{property.city}
        </Text>

        {/* Broker Tag */}
        {broker?.full_name && (
          <Text style={styles.brokerText} numberOfLines={1}>
            By {broker.full_name}{broker.agency_name ? ` (${broker.agency_name})` : ''}
          </Text>
        )}

        {/* Small Rounded View Property Button */}
        <Pressable
          style={styles.viewPropertyPill}
          onPress={() => router.push(`/properties/${property.id}` as any)}
        >
          <Text style={styles.viewPropertyPillText}>View Property</Text>
          <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
  },
  mediaContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerIconWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    pointerEvents: 'none',
  },
  centerIconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  topBar: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 30,
  },
  muteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rightRail: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    alignItems: 'center',
    gap: 12,
    zIndex: 40,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 3,
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIconSaved: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEE2E2',
  },
  callCircle: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  whatsappCircle: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  actionLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 9.5,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  bottomInfo: {
    position: 'absolute',
    left: 12,
    right: 76,
    bottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 30,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  price: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  listingTypeBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  listingTypeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 9,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 0.3,
  },
  specsText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11.5,
    color: '#4B5563',
    marginBottom: 2,
  },
  brokerText: {
    fontFamily: Fonts.sans,
    fontSize: 10.5,
    color: '#6B7280',
    marginBottom: 4,
  },
  viewPropertyPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  viewPropertyPillText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
