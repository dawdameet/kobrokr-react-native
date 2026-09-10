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

        {/* Top Vignette Gradient */}
        <View style={styles.topVignette} />

        {/* Bottom Dark Gradient */}
        <View style={styles.bottomVignette} />

        {/* Play / Pause Indicator */}
        {showPlayIcon && (
          <View style={styles.centerIconWrapper}>
            <View style={styles.centerIconBg}>
              <Ionicons
                name={isPlaying ? 'play' : 'pause'}
                size={42}
                color="#FFFFFF"
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

      {/* Top Controls: Sound Mute Toggle & Walkthrough Tag */}
      <View style={styles.topBar}>
        <View style={styles.walkthroughBadge}>
          <Ionicons name={videoUrl ? "videocam" : "images"} size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.walkthroughText}>
            {videoUrl ? 'VIDEO WALKTHROUGH' : 'PHOTO PREVIEW'}
          </Text>
        </View>

        {videoUrl && (
          <Pressable style={styles.muteButton} onPress={onToggleMute}>
            <Ionicons
              name={isMuted ? 'volume-mute' : 'volume-high'}
              size={18}
              color="#FFFFFF"
            />
          </Pressable>
        )}
      </View>

      {/* Right Sidebar Actions */}
      <View style={styles.rightRail}>
        {/* Like / Save */}
        <Pressable style={styles.actionBtn} onPress={handleToggleSave}>
          <View style={[styles.actionIconCircle, isSaved && styles.actionIconSaved]}>
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={24}
              color={isSaved ? '#EF4444' : '#FFFFFF'}
            />
          </View>
          <Text style={styles.actionLabel}>{isSaved ? 'Saved' : 'Save'}</Text>
        </Pressable>

        {/* Share */}
        <Pressable style={styles.actionBtn} onPress={handleShare}>
          <View style={styles.actionIconCircle}>
            <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>

        {/* Call Broker */}
        {broker?.mobile && (
          <Pressable style={styles.actionBtn} onPress={handleCall}>
            <View style={[styles.actionIconCircle, styles.callCircle]}>
              <Ionicons name="call" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>Call</Text>
          </Pressable>
        )}

        {/* WhatsApp */}
        {broker?.mobile && (
          <Pressable style={styles.actionBtn} onPress={handleWhatsApp}>
            <View style={[styles.actionIconCircle, styles.whatsappCircle]}>
              <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>WhatsApp</Text>
          </Pressable>
        )}
      </View>

      {/* Bottom Information Layer */}
      <View style={styles.bottomInfo}>
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
            <View>
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

        {/* Location & Badges */}
        <View style={styles.locationRow}>
          <Ionicons name="location-sharp" size={14} color="#60A5FA" style={{ marginRight: 4 }} />
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
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  mediaContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 320,
    backgroundColor: 'rgba(0,0,0,0.65)',
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
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 30,
  },
  walkthroughBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  walkthroughText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  muteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  rightRail: {
    position: 'absolute',
    right: 14,
    bottom: 90,
    alignItems: 'center',
    gap: 16,
    zIndex: 30,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
  },
  actionIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  actionIconSaved: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  callCircle: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  whatsappCircle: {
    backgroundColor: '#16A34A',
    borderColor: '#22C55E',
  },
  actionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 76,
    zIndex: 30,
  },
  brokerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  brokerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  brokerAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563EB',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brokerInitial: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brokerName: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  agencyName: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#D1D5DB',
  },
  proBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  proBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  price: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#F3F4F6',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  specsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  specBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  specBadgeText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listingTypeBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.4)',
    borderColor: 'rgba(96, 165, 250, 0.5)',
  },
  listingTypeText: {
    color: '#93C5FD',
  },
  descWrapper: {
    marginBottom: 12,
  },
  description: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: '#E5E7EB',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  moreToggleText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: '#60A5FA',
    marginTop: 2,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.95)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.6)',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  viewDetailsText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
