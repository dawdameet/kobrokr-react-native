import { storage } from './storage';

export const setSession = async (access_token, refresh_token, user) => {
  await storage.set('access_token', access_token);
  await storage.set('refresh_token', refresh_token);
  await storage.set('user', JSON.stringify(user));
};

export const clearSession = async () => {
  await storage.remove('access_token');
  await storage.remove('refresh_token');
  await storage.remove('user');
};

export const getUser = async () => {
  try {
    const userStr = await storage.get('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

export const isLoggedIn = async () => {
  const token = await storage.get('access_token');
  return !!token;
};

export const getUserRole = async () => {
  const user = await getUser();
  return user?.role ?? null;
};

export const getAccessToken = async () => {
  return await storage.get("access_token");
};

export const getRefreshToken = async () => {
  return await storage.get("refresh_token");
};
