import { router } from 'expo-router';
import { storage } from './storage';

export const formatPrice = (p: number) => {
  if (!p) return '—';
  if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
  if (p >= 100000) return `₹${(p / 100000).toFixed(1)} L`;
  return `₹${p.toLocaleString()}`;
};

/**
 * Safely navigates back if possible, otherwise falls back to the dashboard or specified route.
 * Prevents "The action 'GO_BACK' was not handled by any navigator" warning.
 */
export const safeGoBack = async (fallback?: string) => {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  if (fallback) {
    router.replace(fallback as any);
    return;
  }

  try {
    const userStr = await storage.get('user');
    const role = userStr ? JSON.parse(userStr).role : null;
    router.replace(role === 'broker' ? '/(broker)/dashboard' : '/(tenant)/dashboard');
  } catch {
    router.replace('/');
  }
};

