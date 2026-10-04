import { storage } from './storage';

const STORAGE_KEY = 'kobrokr_search_bridge_cache';
const TTL_MS = 5 * 60 * 1000; // 5 minutes soft TTL

export interface SearchBridgePayload {
  windowSlice: any[];
  startIndex: number;
  scrollOffset?: number;
  totalCount: number;
  queryKey: string;
  timestamp: number;
}

let memoryBridge: SearchBridgePayload | null = null;

export const searchBridgeCache = {
  async init() {
    if (memoryBridge) return memoryBridge;
    try {
      const raw = await storage.get(STORAGE_KEY);
      if (raw) {
        memoryBridge = JSON.parse(raw);
      }
    } catch (e) {
      console.log('Failed to read search bridge from storage', e);
    }
    return memoryBridge;
  },

  saveWindow({
    results,
    index,
    scrollOffset,
    totalCount,
    queryKey,
  }: {
    results: any[];
    index: number;
    scrollOffset?: number;
    totalCount: number;
    queryKey: string;
  }) {
    if (!results || !results.length || index < 0) return;
    const start = Math.max(0, index - 1);
    const end = Math.min(results.length, index + 3);
    const windowSlice = results.slice(start, end);

    const payload: SearchBridgePayload = {
      windowSlice,
      startIndex: start,
      scrollOffset: scrollOffset || 0,
      totalCount: totalCount || results.length,
      queryKey: queryKey || '',
      timestamp: Date.now(),
    };

    memoryBridge = payload;
    storage.set(STORAGE_KEY, JSON.stringify(payload));
  },

  getBridge(currentQueryKey: string): SearchBridgePayload | null {
    if (!memoryBridge) return null;

    // Check expiration
    if (Date.now() - (memoryBridge.timestamp || 0) > TTL_MS) {
      this.clear();
      return null;
    }

    // Check query match (normalized)
    const normCurrent = (currentQueryKey || '').replace(/^\?/, '').trim();
    const normCached = (memoryBridge.queryKey || '').replace(/^\?/, '').trim();
    if (normCurrent !== normCached) {
      return null;
    }

    return memoryBridge;
  },

  clear() {
    memoryBridge = null;
    storage.remove(STORAGE_KEY);
  },
};

// Auto-initialize from storage on module load
searchBridgeCache.init().catch(() => {});
