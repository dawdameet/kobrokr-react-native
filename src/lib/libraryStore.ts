import { storage } from './storage';

const STORAGE_KEY = 'kobrokr_library_store';
const TTL_MS = 3 * 60 * 1000; // 3 minutes soft TTL

export interface LibraryState {
  saved: any[];
  collections: any[];
  timestamp: number;
}

let memoryState: LibraryState | null = null;
const listeners = new Set<(state: LibraryState | null) => void>();

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener(memoryState);
    } catch (e) {
      console.error('Error in libraryStore listener', e);
    }
  });
};

export const libraryStore = {
  /**
   * Initialize library cache from persistent AsyncStorage if memory is empty.
   */
  async init(): Promise<LibraryState | null> {
    if (memoryState) return memoryState;
    try {
      const raw = await storage.get(STORAGE_KEY);
      if (raw) {
        memoryState = JSON.parse(raw);
        notify();
      }
    } catch (e) {
      console.log('Failed to load library data from storage', e);
    }
    return memoryState;
  },

  /**
   * Synchronous getter for instant UI mounting.
   */
  getState(): LibraryState | null {
    return memoryState;
  },

  /**
   * Checks whether the in-memory cache is older than TTL.
   */
  isStale(ttlMs = TTL_MS): boolean {
    if (!memoryState || !memoryState.timestamp) return true;
    return Date.now() - memoryState.timestamp > ttlMs;
  },

  /**
   * Sets saved and/or collections data, updates memory and persists to storage.
   */
  setLibraryData({ saved, collections }: { saved?: any[]; collections?: any[] }) {
    memoryState = {
      saved: saved !== undefined ? saved : (memoryState?.saved || []),
      collections: collections !== undefined ? collections : (memoryState?.collections || []),
      timestamp: Date.now(),
    };
    storage.set(STORAGE_KEY, JSON.stringify(memoryState));
    notify();
  },

  /**
   * Optimistically removes a property from saved list.
   */
  removeSaved(propertyId: number) {
    if (!memoryState) return;
    const nextSaved = (memoryState.saved || []).filter(
      (s: any) => (s.properties?.id ?? s.property_id) !== propertyId
    );
    this.setLibraryData({ saved: nextSaved });
  },

  /**
   * Optimistically adds a property to saved list.
   */
  addSaved(savedItem: any) {
    const current = memoryState?.saved || [];
    const propId = savedItem.properties?.id ?? savedItem.property_id;
    if (current.some((s: any) => (s.properties?.id ?? s.property_id) === propId)) return;
    this.setLibraryData({ saved: [savedItem, ...current] });
  },

  /**
   * Optimistically removes a collection.
   */
  removeCollection(collectionId: number) {
    if (!memoryState) return;
    const nextCols = (memoryState.collections || []).filter((c: any) => c.id !== collectionId);
    this.setLibraryData({ collections: nextCols });
  },

  /**
   * Optimistically removes a property from a specific collection.
   */
  removePropertyFromCollection(collectionId: number, propertyId: number) {
    if (!memoryState) return;
    const nextCols = (memoryState.collections || []).map((c: any) => {
      if (c.id === collectionId) {
        return {
          ...c,
          property_ids: (c.property_ids || []).filter((id: number) => id !== propertyId),
        };
      }
      return c;
    });
    this.setLibraryData({ collections: nextCols });
  },

  /**
   * Marks cache as stale so next screen focus triggers background revalidation.
   */
  invalidate() {
    if (memoryState) {
      memoryState.timestamp = 0;
    }
  },

  /**
   * Clears memory and persistent cache.
   */
  clear() {
    memoryState = null;
    storage.remove(STORAGE_KEY);
    notify();
  },

  /**
   * Subscribes a callback to cache updates.
   */
  subscribe(listener: (state: LibraryState | null) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
