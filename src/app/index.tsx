import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { storage } from '../lib/storage';
import OnboardingScreen from './(app)/onboarding';

export default function LandingScreen() {
  const [checking, setChecking] = useState(true);
  const { ref, referral, referral_code } = useLocalSearchParams<{
    ref?: string;
    referral?: string;
    referral_code?: string;
  }>();

  useEffect(() => {
    async function initLanding() {
      const incomingRef = ref || referral || referral_code;
      if (incomingRef) {
        const cleanCode = String(incomingRef).trim().toUpperCase();
        if (cleanCode) {
          await storage.set('applied_referral_code', cleanCode);
        }
      }

      try {
        const userStr = await storage.get('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.role === 'tenant') {
            router.replace('/(tenant)/dashboard');
            return;
          } else if (user.role === 'broker') {
            router.replace('/(broker)/dashboard');
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
      setChecking(false);
    }
    initLanding();
  }, [ref, referral, referral_code]);

  if (checking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <OnboardingScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
