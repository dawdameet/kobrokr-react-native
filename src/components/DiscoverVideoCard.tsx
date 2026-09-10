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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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
      await Share.share({
        title: property.title || 'Property on kobrokr',
        message: `Check out this property on kobrokr: ${property.title} in ${property.locality || ''}, ${property.city} - ${formatPrice(property.price)}`,
      });
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
        <View style={[styles.topBar, { top: Math.max(insets.top, 12) + 52 }]}>
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
      <View style={[styles.rightRail, { bottom: Math.max(insets.bottom, 12) + 78 }]}>
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

      {/* Bottom Information Layer */}
      <View style={[styles.bottomInfo, { bottom: Math.max(insets.bottom, 12) + 72 }]}>
        {/* Broker Tag */}
        {broker && (
          <View style={styles.brokerRow}>
            {broker.profile_photo ? (
              <Image source={{ uri: broker.profile_photo }} style={styles.brokerAvatar} />
            ) : (
              <View style={styles.brokerAvatarFallback}>
                <Text style={styles.brokerInitial}>{broker.full_name?.[0] || 'B'}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.brokerName} numberOfLines={1}>
                {broker.full_name}
              </Text>
              {broker.agency_name ? (
                <Text style={styles.agencyName} numberOfLines={1}>{broker.agency_name}</Text>
              ) : null}
            </View>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO AGENT</Text>
            </View>
          </View>
        )}

        {/* Price */}
        <Text style={styles.price}>{formatPrice(property.price)}</Text>

        {/* Location */}
        <View style={styles.locationRow}>
          <Ionicons name="location-sharp" size={13} color="#2563EB" style={{ marginRight: 3 }} />
          <Text style={styles.locationText} numberOfLines={1}>
            {property.locality ? `${property.locality}, ` : ''}{property.city}
          </Text>
        </View>

        {/* Specs Pill Badges */}
        <View style={styles.specsRow}>
          {property.bhk && (
            <View style={styles.specBadge}>
              <Text style={styles.specBadgeText}>{property.bhk} BHK</Text>
            </View>
          )}
          {property.area && (
            <View style={styles.specBadge}>
              <Text style={styles.specBadgeText}>{property.area} sq ft</Text>
            </View>
          )}
          {property.type && (
            <View style={styles.specBadge}>
              <Text style={styles.specBadgeText}>{property.type.toUpperCase()}</Text>
            </View>
          )}
          {property.listing_type && (
            <View style={[styles.specBadge, styles.listingTypeBadge]}>
              <Text style={[styles.specBadgeText, styles.listingTypeText]}>
                {property.listing_type === 'sale' ? 'FOR SALE' : 'FOR RENT'}
              </Text>
            </View>
          )}
        </View>

        {/* Expandable Caption */}
        {property.description ? (
          <Pressable onPress={() => setIsExpanded(!isExpanded)} style={styles.descWrapper}>
            <Text
              style={styles.description}
              numberOfLines={isExpanded ? undefined : 2}
            >
              {property.description}
            </Text>
            <Text style={styles.moreToggleText}>
              {isExpanded ? 'Show less' : '...more'}
            </Text>
          </Pressable>
        ) : null}

        {/* View Details Button */}
        <Pressable
          style={styles.viewDetailsBtn}
          onPress={() => router.push(`/properties/${property.id}` as any)}
        >
          <Text style={styles.viewDetailsText}>View Property Details</Text>
          <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
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
    top: 14,
    right: 16,
    zIndex: 30,
  },
  muteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    bottom: 30,
    alignItems: 'center',
    gap: 14,
    zIndex: 30,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 10,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 68,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 30,
  },
  brokerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  brokerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  brokerAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brokerInitial: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brokerName: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  agencyName: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#6B7280',
  },
  proBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  proBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 8,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  price: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#4B5563',
    flex: 1,
  },
  specsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 8,
  },
  specBadge: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  specBadgeText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  listingTypeBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  listingTypeText: {
    color: '#2563EB',
  },
  descWrapper: {
    marginBottom: 10,
  },
  description: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: '#4B5563',
  },
  moreToggleText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: '#2563EB',
    marginTop: 2,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  viewDetailsText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
