import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const NOTIFICATION_HISTORY_KEY = '@kobrokr_notification_history';
const MAX_HISTORY_ITEMS = 30;

export interface NotificationHistoryItem {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  scheduledFor?: string;
  sentAt: string;
  delaySeconds: number;
  sound: boolean;
  route?: string;
}

export interface SendNotificationOptions {
  title: string;
  body: string;
  data?: Record<string, any>;
  delaySeconds?: number;
  sound?: boolean;
  badge?: number;
  route?: string;
}

// Ensure foreground notifications display alerts/banners, sound, and badge
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let isInitialized = false;
let responseSubscription: Notifications.EventSubscription | null = null;
let receivedSubscription: Notifications.EventSubscription | null = null;

/**
 * Initialize notifications: creates Android channels and sets up listeners.
 */
export async function initNotifications() {
  if (isInitialized) return;
  isInitialized = true;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('urgent', {
        name: 'Urgent Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#DC2626',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    // Set up notification tap response listener (deep link handling)
    if (!responseSubscription) {
      responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        try {
          const data = response.notification.request.content.data;
          const targetRoute = data?.route || data?.url;
          if (targetRoute && typeof targetRoute === 'string') {
            // Small timeout to allow app navigation hierarchy to settle if launched from cold
            setTimeout(() => {
              router.push(targetRoute as any);
            }, 300);
          }
        } catch (err) {
          console.warn('[Notifications] Error handling notification tap:', err);
        }
      });
    }

    if (!receivedSubscription) {
      receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
        console.log('[Notifications] Received notification in foreground:', notification.request.identifier);
      });
    }
  } catch (error) {
    console.warn('[Notifications] initNotifications warning:', error);
  }
}

/**
 * Request notification permissions from the OS.
 */
export async function requestNotificationPermissions(): Promise<{
  granted: boolean;
  status: Notifications.PermissionStatus;
  canAskAgain: boolean;
}> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) {
      return { granted: true, status: existing.status, canAskAgain: existing.canAskAgain };
    }

    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    return {
      granted: requested.granted,
      status: requested.status,
      canAskAgain: requested.canAskAgain,
    };
  } catch (err) {
    console.warn('[Notifications] Permission request error:', err);
    return {
      granted: false,
      status: Notifications.PermissionStatus.UNDETERMINED,
      canAskAgain: true,
    };
  }
}

/**
 * Check current notification permissions without prompting.
 */
export async function getNotificationPermissions(): Promise<Notifications.NotificationPermissionsStatus | null> {
  try {
    return await Notifications.getPermissionsAsync();
  } catch {
    return null;
  }
}

/**
 * Schedule or immediately send a local notification.
 */
export async function sendLocalNotification(options: SendNotificationOptions): Promise<string> {
  const {
    title,
    body,
    data = {},
    delaySeconds = 0,
    sound = true,
    badge,
    route,
  } = options;

  // Merge route into payload data if provided
  const mergedData: Record<string, any> = { ...data };
  if (route) {
    mergedData.route = route;
  }

  // Define trigger: null means immediately, otherwise time interval in seconds
  let trigger: Notifications.NotificationTriggerInput = null;
  if (delaySeconds > 0) {
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delaySeconds,
      repeats: false,
    };
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: mergedData,
      sound: sound ? 'default' : undefined,
      badge: badge !== undefined ? badge : undefined,
    },
    trigger,
  });

  // Save to history log
  const now = new Date();
  const historyItem: NotificationHistoryItem = {
    id: notificationId,
    title,
    body,
    data: mergedData,
    sentAt: now.toISOString(),
    scheduledFor: delaySeconds > 0 ? new Date(now.getTime() + delaySeconds * 1000).toISOString() : undefined,
    delaySeconds,
    sound,
    route,
  };

  await saveHistoryItem(historyItem);

  return notificationId;
}

/**
 * Retrieve saved notification history.
 */
export async function getNotificationHistory(): Promise<NotificationHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Save an item to the notification history.
 */
async function saveHistoryItem(item: NotificationHistoryItem) {
  try {
    const history = await getNotificationHistory();
    const updated = [item, ...history.filter((h) => h.id !== item.id)].slice(0, MAX_HISTORY_ITEMS);
    await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[Notifications] Failed to save history item:', err);
  }
}

/**
 * Clear notification history.
 */
export async function clearNotificationHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_HISTORY_KEY);
  } catch (err) {
    console.warn('[Notifications] Failed to clear history:', err);
  }
}

/**
 * Fetch all currently scheduled (pending) notifications.
 */
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return [];
  }
}

/**
 * Cancel a specific scheduled notification by id.
 */
export async function cancelScheduledNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (err) {
    console.warn('[Notifications] Failed to cancel scheduled notification:', err);
  }
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('[Notifications] Failed to cancel all scheduled notifications:', err);
  }
}

/**
 * Dismiss all delivered notifications from the notification tray.
 */
export async function dismissAllDeliveredNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (err) {
    console.warn('[Notifications] Failed to dismiss all notifications:', err);
  }
}

/**
 * Reset app icon badge count to 0.
 */
export async function resetBadgeCount(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (err) {
    console.warn('[Notifications] Failed to reset badge count:', err);
  }
}
