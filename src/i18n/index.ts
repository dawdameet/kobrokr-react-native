import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { storage } from '../lib/storage';

import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

export const LANGUAGE_STORAGE_KEY = 'user_language';

export interface SupportedLanguage {
  code: string;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
];

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  mr: { translation: mr },
};

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// Load stored language preference on startup
(async () => {
  try {
    const savedLang = await storage.get(LANGUAGE_STORAGE_KEY);
    if (savedLang && ['en', 'hi', 'mr'].includes(savedLang)) {
      await i18n.changeLanguage(savedLang);
    }
  } catch (err) {
    console.warn('[i18n] Error loading initial language:', err);
  }
})();

export const setAppLanguage = async (code: string) => {
  try {
    await i18n.changeLanguage(code);
    await storage.set(LANGUAGE_STORAGE_KEY, code);
  } catch (err) {
    console.error('[i18n] Failed to switch language:', err);
  }
};

export default i18n;
