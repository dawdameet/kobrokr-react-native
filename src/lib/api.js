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

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isAuthRoute =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/signup') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/google') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/resend-verification') ||
      originalRequest.url?.includes('/auth/forgot-password') ||
      originalRequest.url?.includes('/auth/reset-password') ||
      originalRequest.url?.includes('/auth/otp/') ||
      originalRequest.url?.includes('/auth/email-otp/');

    // Do not attempt token refresh or force-logout for auth endpoints
    if (isAuthRoute) {
      return Promise.reject(error);
    }

    // Prevent infinite loop on protected endpoints
    if (
      error.response?.status === 401 &&
      !originalRequest._retry
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

// ── OTP Services ──────────────────────────────────────────────────────────────
export const otpService = {
  /** Send login OTP to phone. */
  send: (phone) => api.post('/auth/otp/send', { phone }),

  /** Send signup OTP to phone. */
  sendSignup: (phone) => api.post('/auth/otp/send-signup', { phone }),

  /** Verify phone OTP without consuming (pre-verification). */
  verify: (phone, otp, purpose = 'signup') =>
    api.post('/auth/otp/verify', { phone, otp, purpose, consume: false }),

  /** Verify OTP and log in. Returns { access_token, refresh_token, user }. */
  login: (phone, otp, role) => api.post('/auth/otp/login', { phone, otp, role }),

  /** Verify OTP and create account. Returns { access_token, refresh_token, user }. */
  signup: (data) => api.post('/auth/otp/signup', data),

  /** Send password reset OTP to phone. */
  resetSend: (phone) => api.post('/auth/otp/reset', { phone }),

  /** Verify OTP and set new password in one step. */
  resetConfirm: (phone, otp, new_password) =>
    api.post('/auth/otp/reset-confirm', { phone, otp, new_password }),
};

export const emailOtpService = {
  /** Send signup OTP to email. */
  sendSignup: (email) => api.post('/auth/email-otp/send', { email }),

  /** Verify email OTP without consuming (pre-verification). */
  verify: (email, otp, purpose = 'signup') =>
    api.post('/auth/email-otp/verify', { email, otp, purpose, consume: false }),
};

export default api;
