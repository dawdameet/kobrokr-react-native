import { storage } from './storage';

const STORAGE_KEY = 'kobrokr_dashboard_stats';
const TTL_MS = 5 * 60 * 1000; // 5 minutes soft TTL

interface StatsState {
  broker?: {
    listings: number;
    active: number;
    saved: number;
  };
  tenant?: {
    saved: number;
  };
  timestamp?: number;
}

let memoryStats: StatsState | null = null;
const listeners = new Set<(stats: StatsState | null) => void>();

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener(memoryStats);
    } catch (e) {
      console.error('Error in statsStore listener', e);
    }
  });
};

export const statsStore = {
  async init() {
    if (memoryStats) return memoryStats;
    try {
      const raw = await storage.get(STORAGE_KEY);
      if (raw) {
        memoryStats = JSON.parse(raw);
        notify();
      }
    } catch (e) {
      console.log('Failed to load stats from storage', e);
    }
    return memoryStats;
  },

  getStats(): StatsState | null {
    return memoryStats;
  },

  isStale(): boolean {
    if (!memoryStats || !memoryStats.timestamp) return true;
    return Date.now() - memoryStats.timestamp > TTL_MS;
  },

  setBrokerStats({ listings, active, saved }: { listings: number; active: number; saved: number }) {
    memoryStats = {
      ...(memoryStats || {}),
      broker: {
        listings: Math.max(0, Number(listings) || 0),
        active: Math.max(0, Number(active) || 0),
        saved: Math.max(0, Number(saved) || 0),
      },
      timestamp: Date.now(),
    };
    storage.set(STORAGE_KEY, JSON.stringify(memoryStats));
    notify();
  },

  setTenantStats({ saved }: { saved: number }) {
    memoryStats = {
      ...(memoryStats || {}),
      tenant: {
        saved: Math.max(0, Number(saved) || 0),
      },
      timestamp: Date.now(),
    };
    storage.set(STORAGE_KEY, JSON.stringify(memoryStats));
    notify();
  },

  incrementListings(isActive: boolean = true) {
    const broker = memoryStats?.broker || { listings: 0, active: 0, saved: 0 };
    this.setBrokerStats({
      listings: broker.listings + 1,
      active: isActive ? broker.active + 1 : broker.active,
      saved: broker.saved,
    });
  },

  decrementListings(wasActive: boolean = true) {
    const broker = memoryStats?.broker || { listings: 0, active: 0, saved: 0 };
    this.setBrokerStats({
      listings: Math.max(0, broker.listings - 1),
      active: wasActive ? Math.max(0, broker.active - 1) : broker.active,
      saved: broker.saved,
    });
  },

  updateListingStatus(oldStatus: string, newStatus: string) {
    if (oldStatus === newStatus) return;
    const broker = memoryStats?.broker || { listings: 0, active: 0, saved: 0 };
    let activeDelta = 0;
    if (oldStatus === 'active' && newStatus !== 'active') activeDelta = -1;
    else if (oldStatus !== 'active' && newStatus === 'active') activeDelta = 1;

    this.setBrokerStats({
      listings: broker.listings,
      active: Math.max(0, broker.active + activeDelta),
      saved: broker.saved,
    });
  },

  incrementSaved() {
    const brokerSaved = memoryStats?.broker?.saved ?? 0;
    const tenantSaved = memoryStats?.tenant?.saved ?? 0;

    memoryStats = {
      ...(memoryStats || {}),
      broker: memoryStats?.broker ? { ...memoryStats.broker, saved: brokerSaved + 1 } : { listings: 0, active: 0, saved: 1 },
      tenant: { saved: tenantSaved + 1 },
      timestamp: Date.now(),
    };
    storage.set(STORAGE_KEY, JSON.stringify(memoryStats));
    notify();
  },

  decrementSaved() {
    const brokerSaved = memoryStats?.broker?.saved ?? 0;
    const tenantSaved = memoryStats?.tenant?.saved ?? 0;

    memoryStats = {
      ...(memoryStats || {}),
      broker: memoryStats?.broker ? { ...memoryStats.broker, saved: Math.max(0, brokerSaved - 1) } : { listings: 0, active: 0, saved: 0 },
      tenant: { saved: Math.max(0, tenantSaved - 1) },
      timestamp: Date.now(),
    };
    storage.set(STORAGE_KEY, JSON.stringify(memoryStats));
    notify();
  },

  subscribe(listener: (stats: StatsState | null) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  clear() {
    memoryStats = null;
    storage.remove(STORAGE_KEY);
    notify();
  },
};

// Auto-initialize store from storage on module load
statsStore.init().catch(() => {});
