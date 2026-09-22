import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { usePathname, router } from 'expo-router';
import { storage } from '../lib/storage';
import api from '../lib/api';

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/client-share'];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

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

    // Validate token with a lightweight server call (only on initial mount / route changes to protected areas)
    try {
      const { data } = await api.get('/auth/profile');
      // Update cached user data with fresh server data
      if (data && data.id) {
        await storage.set('user', JSON.stringify(data));
      }
      setStatus('ready');
    } catch (err: any) {
      // If 401/403, the interceptor will try refresh. If that also fails, api.js logs out.
      // If it's a network error, let the user through with cached data.
      if (err.response?.status === 401 || err.response?.status === 403) {
        // Interceptor already handles logout, but just in case:
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
