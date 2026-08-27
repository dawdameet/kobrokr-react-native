import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  get: async (key) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: async (key, value) => {
    try {
      await AsyncStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
};

export const syncStorage = {
  // Simple in-memory fallback for synchronous access if absolutely needed before async loads
  // However, it's recommended to await storage.get()
  _cache: {},
  get: (key) => syncStorage._cache[key] || null,
  set: (key, value) => { syncStorage._cache[key] = value; },
  remove: (key) => { delete syncStorage._cache[key]; }
};
