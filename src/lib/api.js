import axios from 'axios';
import { storage } from './storage';
import { router } from 'expo-router';

// Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000'
// We use the environment variable if available
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://kobrokr.onrender.com',
});

let inMemoryAccessToken = null;

export function setCachedToken(token) {
  inMemoryAccessToken = token;
}

export function clearCachedToken() {
  inMemoryAccessToken = null;
}

// --------------------
// Request interceptor
// --------------------
api.interceptors.request.use(async (config) => {
  let token = inMemoryAccessToken;
  if (!token) {
    token = await storage.get('access_token');
    if (token) inMemoryAccessToken = token;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// --------------------
// Response interceptor
// --------------------
api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // Prevent infinite loop and don't intercept login requests
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      originalRequest._retry = true;

      const refreshToken = await storage.get('refresh_token');

      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL || 'https://kobrokr.onrender.com'}/auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
          }
        );

        inMemoryAccessToken = data.access_token;
        await storage.set('access_token', data.access_token);

        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;

        return api(originalRequest);
      } catch (e) {
        logout();
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

async function logout() {
  inMemoryAccessToken = null;
  await storage.remove('access_token');
  await storage.remove('refresh_token');
  await storage.remove('user');

  // Navigate to login screen
  router.replace('/login');
}

export default api;
