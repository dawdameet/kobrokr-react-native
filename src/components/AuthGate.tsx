import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { usePathname, router } from 'expo-router';
import { storage } from '../lib/storage';
import api, { setCachedToken } from '../lib/api';

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/client-share'];
const PROFILE_VALIDATION_TTL = 5 * 60 * 1000; // 5 minutes

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const lastValidatedRef = useRef<number>(0);
  const isInitialCheckDone = useRef<boolean>(false);

  useEffect(() => {
    checkAuth();
  }, [pathname]);

  const checkAuth = async () => {
    const isPublic = PUBLIC_ROUTES.includes(pathname);

    // Public routes don't need auth
    if (isPublic) {
      setStatus('ready');
      return;
    }

    // Check if we have tokens at all
    const token = await storage.get('access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setCachedToken(token);

    const now = Date.now();
    const isValidationFresh = (now - lastValidatedRef.current) < PROFILE_VALIDATION_TTL;

    // If initial check is already done and validation is fresh, don't refetch on every tab switch
    if (isInitialCheckDone.current && isValidationFresh) {
      setStatus('ready');
      return;
    }

    // Validate token with a lightweight server call
    try {
      const { data } = await api.get('/auth/profile');
      if (data && data.id) {
        await storage.set('user', JSON.stringify(data));
      }
      lastValidatedRef.current = Date.now();
      isInitialCheckDone.current = true;
      setStatus('ready');
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        await storage.remove('access_token');
        await storage.remove('refresh_token');
        await storage.remove('user');
        router.replace('/login');
        return;
      }
      // Network error — allow through with cached data
      const user = await storage.get('user');
      if (!user) {
        router.replace('/login');
        return;
      }
      isInitialCheckDone.current = true;
      setStatus('ready');
    }
  };

  if (status === 'loading' && !PUBLIC_ROUTES.includes(pathname)) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
});
