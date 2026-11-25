import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
} from 'react-native-purchases';

// Detect whether running inside Expo Go (native StoreKit IAP requires dev build or Test Store key)
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo';

// RevenueCat iOS Public API key from environment
const REVENUECAT_APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || '';

// Product IDs created in App Store Connect
export const PRODUCT_IDS = {
  PRO_MONTHLY: 'com.kobrokr.mobile.pro.monthly',
  PRO_ANNUAL: 'com.kobrokr.mobile.pro.annual',
} as const;

// Entitlement identifier in RevenueCat (standard: 'pro')
export const ENTITLEMENT_ID = 'pro';

let isConfigured = false;

/**
 * Initialize RevenueCat SDK
 * Safe to call on all platforms; only activates on iOS/Android
 */
export async function initPurchases(userId?: string): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  if (isExpoGo) {
    console.log('[Purchases] Expo Go detected: skipping native StoreKit initialization. Native IAP requires a development build.');
    return;
  }

  if (!REVENUECAT_APPLE_KEY) {
    console.warn('[Purchases] RevenueCat Apple API key is not configured in environment.');
    return;
  }

  try {
    if (!isConfigured) {
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      } else {
        await Purchases.setLogLevel(LOG_LEVEL.INFO);
      }

      await Purchases.configure({
        apiKey: REVENUECAT_APPLE_KEY,
        appUserID: userId || undefined,
      });

      isConfigured = true;
      console.log('[Purchases] RevenueCat configured successfully.');
    } else if (userId) {
      await Purchases.logIn(userId);
    }
  } catch (error) {
    console.error('[Purchases] Error initializing RevenueCat:', error);
  }
}

/**
 * Identify the logged in broker in RevenueCat using their Supabase UUID
 */
export async function identifyPurchasesUser(userId: string): Promise<CustomerInfo | null> {
  if (Platform.OS !== 'ios' || !isConfigured) return null;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    return customerInfo;
  } catch (error) {
    console.warn('[Purchases] Failed to log in user to RevenueCat:', error);
    return null;
  }
}

/**
 * Reset RevenueCat identity on logout
 */
export async function logoutPurchases(): Promise<void> {
  if (Platform.OS !== 'ios' || !isConfigured) return;
  try {
    await Purchases.logOut();
  } catch (error) {
    console.warn('[Purchases] Failed to log out of RevenueCat:', error);
  }
}

/**
 * Fetch subscription packages configured in RevenueCat / App Store Connect
 */
export async function getSubscriptionPackages(): Promise<{
  monthly?: PurchasesPackage;
  annual?: PurchasesPackage;
  currentOffering?: PurchasesOffering | null;
}> {
  if (Platform.OS !== 'ios' || isExpoGo) {
    return {};
  }

  if (!isConfigured) {
    await initPurchases();
  }

  try {
    const offerings = await Purchases.getOfferings();
    if (!offerings.current) {
      console.warn('[Purchases] No current offerings found in RevenueCat.');
      return {};
    }

    const currentOffering = offerings.current;
    const available = currentOffering.availablePackages;

    const monthly =
      available.find((pkg) => pkg.identifier === '$rc_monthly' || pkg.product.identifier === PRODUCT_IDS.PRO_MONTHLY) ||
      currentOffering.monthly ||
      undefined;

    const annual =
      available.find((pkg) => pkg.identifier === '$rc_annual' || pkg.product.identifier === PRODUCT_IDS.PRO_ANNUAL) ||
      currentOffering.annual ||
      undefined;

    return { monthly, annual, currentOffering };
  } catch (error) {
    console.error('[Purchases] Error fetching offerings:', error);
    return {};
  }
}

/**
 * Purchase a selected subscription package via native Apple StoreKit sheet
 */
export async function purchaseSubscriptionPackage(pkg: PurchasesPackage): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  userCancelled?: boolean;
  error?: string;
}> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const hasPro = hasActivePro(customerInfo);

    return {
      success: hasPro || true,
      customerInfo,
    };
  } catch (err: any) {
    if (err.userCancelled) {
      return { success: false, userCancelled: true };
    }
    console.error('[Purchases] Purchase failed:', err);
    return {
      success: false,
      error: err.message || 'The purchase could not be completed. Please try again.',
    };
  }
}

/**
 * Restore previous purchases (Mandatory for Apple App Store approval)
 */
export async function restoreUserPurchases(): Promise<{
  success: boolean;
  hasPro: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  if (Platform.OS !== 'ios') {
    return { success: false, hasPro: false, error: 'In-app purchases are only available on iOS.' };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const hasPro = hasActivePro(customerInfo);

    return {
      success: true,
      hasPro,
      customerInfo,
    };
  } catch (err: any) {
    console.error('[Purchases] Restore failed:', err);
    return {
      success: false,
      hasPro: false,
      error: err.message || 'Could not restore purchases. Please check your Apple account and try again.',
    };
  }
}

/**
 * Helper to verify whether CustomerInfo grants active Pro access
 */
export function hasActivePro(customerInfo?: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return (
    typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined' ||
    typeof customerInfo.entitlements.active['pro'] !== 'undefined' ||
    typeof customerInfo.entitlements.active['individual'] !== 'undefined'
  );
}
