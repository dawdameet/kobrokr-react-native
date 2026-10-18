import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Fonts } from '../constants/theme';
import { sendLocalNotification, requestNotificationPermissions } from '../lib/notifications';

interface NotificationDebugCardProps {
  style?: any;
}

export default function NotificationDebugCard({ style }: NotificationDebugCardProps) {
  if (!__DEV__) {
    return null;
  }
  const { t } = useTranslation();
  const [quickSending, setQuickSending] = useState(false);
  const [quickSuccess, setQuickSuccess] = useState(false);

  const handleQuickTest = async () => {
    try {
      setQuickSending(true);
      await requestNotificationPermissions();
      await sendLocalNotification({
        title: '🔔 Test Notification from Dashboard',
        body: 'Local notification pipeline is working smoothly on KoBrokr mobile!',
        delaySeconds: 0,
        sound: true,
        data: {
          route: '/debug-notifications',
          source: 'dashboard-quick-test',
        },
      });
      setQuickSuccess(true);
      setTimeout(() => setQuickSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to dispatch quick test notification:', err);
    } finally {
      setQuickSending(false);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Top Tag & Status */}
      <View style={styles.topRow}>
        <View style={styles.badgeContainer}>
          <View style={styles.pulsingDot} />
          <Text style={styles.badgeText}>{t('debugNotifications.badge', { defaultValue: 'DEVELOPER LAB' })}</Text>
        </View>
        <Text style={styles.envTag}>DEBUG</Text>
      </View>

      {/* Main Content Row */}
      <View style={styles.contentRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="notifications" size={24} color="#FFFFFF" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {t('debugNotifications.cardTitle', { defaultValue: 'Notification Debugger' })}
          </Text>
          <Text style={styles.subtitle}>
            {t('debugNotifications.cardSubtitle', { defaultValue: 'Create, schedule & dispatch custom push and local notifications.' })}
          </Text>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.buttonRow}>
        {/* Quick Send Button */}
        <Pressable
          style={[styles.quickButton, quickSuccess && styles.quickButtonSuccess]}
          onPress={handleQuickTest}
          disabled={quickSending}
        >
          {quickSending ? (
            <ActivityIndicator size="small" color="#4338CA" />
          ) : quickSuccess ? (
            <>
              <Ionicons name="checkmark-circle" size={16} color="#15803D" />
              <Text style={styles.quickButtonTextSuccess}>
                {t('debugNotifications.sent', { defaultValue: 'Sent!' })}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="flash" size={15} color="#4338CA" />
              <Text style={styles.quickButtonText}>
                {t('debugNotifications.quickSend', { defaultValue: 'Quick Alert' })}
              </Text>
            </>
          )}
        </Pressable>

        {/* Full Screen Launcher Button */}
        <Pressable
          style={styles.openLabButton}
          onPress={() => router.push('/debug-notifications' as any)}
        >
          <Text style={styles.openLabButtonText}>
            {t('debugNotifications.openStudio', { defaultValue: 'Open Debugger' })}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F7FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    marginBottom: 24,
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 6,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4F46E5',
  },
  badgeText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 10,
    color: '#4338CA',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  envTag: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 3,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  quickButtonSuccess: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  quickButtonText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#4338CA',
  },
  quickButtonTextSuccess: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#15803D',
  },
  openLabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  openLabButtonText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
