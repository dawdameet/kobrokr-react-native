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

  const isDarkNav = pathname === '/discover';

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

  const activeColor = isDarkNav ? '#60A5FA' : '#2563EB';
  const inactiveColor = isDarkNav ? '#6B7280' : '#9CA3AF';

  return (
    <View style={[
      styles.container,
      isDarkNav && styles.darkContainer,
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
            <Ionicons
              name={active ? item.activeIcon : item.icon}
              size={22}
              color={active ? activeColor : inactiveColor}
              style={styles.icon}
            />
            <Text 
              style={[
                styles.label,
                active
                  ? (isDarkNav ? styles.activeDarkLabel : styles.activeLabel)
                  : (isDarkNav ? styles.inactiveDarkLabel : styles.inactiveLabel)
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
  darkContainer: {
    backgroundColor: '#000000',
    borderTopColor: '#1E293B',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: 4,
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
  activeDarkLabel: {
    fontFamily: Fonts.sansBold,
    color: '#60A5FA',
    fontWeight: '700',
  },
  inactiveLabel: {
    fontFamily: Fonts.sansMedium,
    color: '#9CA3AF',
  },
  inactiveDarkLabel: {
    fontFamily: Fonts.sansMedium,
    color: '#6B7280',
  }
});
