import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '../lib/storage';
import { Fonts } from '../constants/theme';

export default function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function getRole() {
      const u = await storage.get('user');
      if (u) {
        setRole(JSON.parse(u).role);
      }
    }
    getRole();
  }, []);

  const brokerNavItems = [
    { to: '/dashboard',   label: 'Dashboard',   icon: 'grid-outline' as const, activeIcon: 'grid' as const },
    { to: '/discover',    label: 'Discover',    icon: 'play-circle-outline' as const, activeIcon: 'play-circle' as const },
    { to: '/my-listings', label: 'My Listings', icon: 'list-outline' as const, activeIcon: 'list' as const },
    { to: '/search',      label: 'Search',      icon: 'search-outline' as const, activeIcon: 'search' as const },
    { to: '/saved',       label: 'Saved',       icon: 'heart-outline' as const, activeIcon: 'heart' as const },
  ];

  const tenantNavItems = [
    { to: '/dashboard',   label: 'Home',        icon: 'grid-outline' as const, activeIcon: 'grid' as const },
    { to: '/discover',    label: 'Discover',    icon: 'play-circle-outline' as const, activeIcon: 'play-circle' as const },
    { to: '/search',      label: 'Search',      icon: 'search-outline' as const, activeIcon: 'search' as const },
    { to: '/saved',       label: 'Saved',       icon: 'heart-outline' as const, activeIcon: 'heart' as const },
  ];

  const navItems = role === 'broker' ? brokerNavItems : tenantNavItems;
  const isDiscover = pathname === '/discover';

  const isActive = (to: string) => {
    if (pathname === to) return true;
    if (pathname === '/' && to === '/dashboard') return true;
    return false;
  };

  const handlePress = (to: string) => {
    // We map the display paths to the actual expo-router paths
    if (to === '/dashboard') {
      router.replace(role === 'broker' ? '/(broker)/dashboard' : '/(tenant)/dashboard');
    } else if (to === '/my-listings') {
      router.replace('/(broker)/my-listings');
    } else if (to === '/discover') {
      router.replace('/discover');
    } else {
      router.replace(to as any);
    }
  };

  if (!role) return null; // Don't show if we don't know the role yet

  return (
    <View style={[
      styles.container,
      isDiscover && styles.discoverContainer,
      { paddingBottom: Math.max(insets.bottom, 12) }
    ]}>
      {navItems.map((item) => {
        const active = isActive(item.to);
        return (
          <Pressable
            key={item.to}
            style={styles.navItem}
            onPress={() => handlePress(item.to)}
          >
            <View style={[
              styles.iconWrapper,
              isDiscover && styles.discoverIconWrapper,
              isDiscover && active && styles.discoverActiveIconWrapper,
            ]}>
              <Ionicons
                name={active ? item.activeIcon : item.icon}
                size={isDiscover ? 20 : 22}
                color={
                  isDiscover
                    ? (active ? '#FFFFFF' : '#111827')
                    : (active ? '#2563EB' : '#9CA3AF')
                }
              />
            </View>
            <Text 
              style={[
                styles.label,
                active ? styles.activeLabel : styles.inactiveLabel,
                isDiscover && styles.discoverLabel,
                isDiscover && active && styles.discoverActiveLabel,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  discoverContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    paddingTop: 6,
    zIndex: 50,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discoverIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  discoverActiveIconWrapper: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
    shadowColor: '#2563EB',
    shadowOpacity: 0.35,
  },
  label: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    fontWeight: '500',
  },
  activeLabel: {
    fontFamily: Fonts.sansBold,
    color: '#2563EB',
    fontWeight: '700',
  },
  inactiveLabel: {
    fontFamily: Fonts.sansMedium,
    color: '#9CA3AF',
  },
  discoverLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  discoverActiveLabel: {
    fontFamily: Fonts.sansBold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
