import React, { useEffect } from 'react';
import { Slot, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import BottomNav from '../components/BottomNav';
import AuthGate from '../components/AuthGate';

// Keep the splash screen visible while fonts are loading
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const pathname = usePathname();
  const hideNavOn = ['/login', '/signup', '/onboarding', '/add-property', '/client-share'];
  const isDetailsRoute = pathname.startsWith('/properties/');
  const isHidden = hideNavOn.includes(pathname) || isDetailsRoute || pathname === '/';

  const [fontsLoaded, fontError] = useFonts({
    'IBMPlexSans-Regular': require('../../assets/fonts/IBMPlexSans-Regular.ttf'),
    'IBMPlexSans-Medium': require('../../assets/fonts/IBMPlexSans-Medium.ttf'),
    'IBMPlexSans-SemiBold': require('../../assets/fonts/IBMPlexSans-SemiBold.ttf'),
    'IBMPlexSans-Bold': require('../../assets/fonts/IBMPlexSans-Bold.ttf'),
    'SpaceGrotesk-Medium': require('../../assets/fonts/SpaceGrotesk-Medium.ttf'),
    'SpaceGrotesk-SemiBold': require('../../assets/fonts/SpaceGrotesk-SemiBold.ttf'),
    'SpaceGrotesk-Bold': require('../../assets/fonts/SpaceGrotesk-Bold.ttf'),
    'IBMPlexMono-Regular': require('../../assets/fonts/IBMPlexMono-Regular.ttf'),
    'IBMPlexMono-Medium': require('../../assets/fonts/IBMPlexMono-Medium.ttf'),
    'IBMPlexMono-SemiBold': require('../../assets/fonts/IBMPlexMono-SemiBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthGate>
        <View style={{ flex: 1 }}>
          <Slot />
          {!isHidden && <BottomNav />}
        </View>
      </AuthGate>
    </SafeAreaProvider>
  );
}


