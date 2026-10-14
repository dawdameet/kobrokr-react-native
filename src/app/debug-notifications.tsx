import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Fonts } from '../constants/theme';
import {
  sendLocalNotification,
  requestNotificationPermissions,
  getNotificationPermissions,
  getNotificationHistory,
  clearNotificationHistory,
  getAllScheduledNotifications,
  cancelScheduledNotification,
  cancelAllScheduledNotifications,
  dismissAllDeliveredNotifications,
  resetBadgeCount,
  NotificationHistoryItem,
} from '../lib/notifications';

interface PresetItem {
  id: string;
  name: string;
  title: string;
  body: string;
  route: string;
  badge?: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const PRESETS: PresetItem[] = [
  {
    id: 'listing',
    name: 'New Listing',
    title: '🏢 New Property Match in Bandra West',
    body: 'Spacious 3 BHK Sea-facing apartment just listed for ₹1.85 Cr. High brokerage potential!',
    route: '/(broker)/my-listings',
    icon: 'home',
    color: '#2563EB',
  },
  {
    id: 'inquiry',
    name: 'Broker Lead',
    title: '💬 New Inquiry Received',
    body: 'Broker Rajesh Sharma wants to collaborate on 2 BHK in Andheri East.',
    route: '/(broker)/dashboard',
    icon: 'chatbubbles',
    color: '#059669',
  },
  {
    id: 'price-drop',
    name: 'Price Drop',
    title: '🏷️ Price Drop Alert (₹10,000 Off)',
    body: 'A property on your saved list dropped its rental price. Check it out now!',
    route: '/saved',
    icon: 'trending-down',
    color: '#D97706',
  },
  {
    id: 'viewing',
    name: 'Viewing Alert',
    title: '📅 Client Viewing Scheduled',
    body: 'Tenant requested a walkthrough for tomorrow at 4:30 PM in Juhu.',
    route: '/search',
    icon: 'calendar',
    color: '#7C3AED',
  },
  {
    id: 'partner',
    name: 'Partner Credit',
    title: '🎉 Referral Bonus Credited',
    body: 'You earned ₹2,500 from your referred broker’s recent subscription.',
    route: '/partner',
    icon: 'ribbon',
    color: '#DB2777',
  },
];

const ROUTE_SUGGESTIONS = [
  { label: 'None', route: '' },
  { label: 'Broker Dash', route: '/(broker)/dashboard' },
  { label: 'Tenant Dash', route: '/(tenant)/dashboard' },
  { label: 'My Listings', route: '/(broker)/my-listings' },
  { label: 'Saved', route: '/saved' },
  { label: 'Search', route: '/search' },
  { label: 'Partner', route: '/partner' },
  { label: 'Profile', route: '/profile' },
  { label: 'Discover', route: '/discover' },
];

const DELAY_OPTIONS = [0, 3, 5, 10, 30];

export default function NotificationDebugScreen() {
  const { t } = useTranslation();

  // Form State
  const [title, setTitle] = useState('🔔 KoBrokr Test Notification');
  const [body, setBody] = useState('This is a test notification dispatched from the KoBrokr Notification Lab.');
  const [targetRoute, setTargetRoute] = useState('/(broker)/my-listings');
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [customDelay, setCustomDelay] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [badgeCount, setBadgeCount] = useState<number | undefined>(1);
  const [customDataKey, setCustomDataKey] = useState('');
  const [customDataVal, setCustomDataVal] = useState('');

  // Status & lists state
  const [permissionStatus, setPermissionStatus] = useState<string>('checking');
  const [isSending, setIsSending] = useState(false);
  const [activeCountdown, setActiveCountdown] = useState<number | null>(null);
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [scheduledRequests, setScheduledRequests] = useState<any[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadPermissions();
    refreshData();
  }, []);

  const loadPermissions = async () => {
    const perm = await getNotificationPermissions();
    setPermissionStatus(perm ? perm.status : 'undetermined');
  };

  const refreshData = async () => {
    const hist = await getNotificationHistory();
    setHistory(hist);
    const sched = await getAllScheduledNotifications();
    setScheduledRequests(sched);
  };

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermissions();
    setPermissionStatus(result.status);
    if (result.granted) {
      showToast('Notifications permission granted!', 'success');
    } else {
      showToast('Notifications permission not granted', 'error');
    }
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg((curr) => (curr?.text === text ? null : curr));
    }, 4000);
  };

  const applyPreset = (preset: PresetItem) => {
    setTitle(preset.title);
    setBody(preset.body);
    setTargetRoute(preset.route);
    showToast(`Loaded preset: ${preset.name}`, 'success');
  };

  const handleSend = async (overrideDelay?: number) => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a notification title.');
      return;
    }

    const effectiveDelay = overrideDelay !== undefined 
      ? overrideDelay 
      : (customDelay ? parseInt(customDelay, 10) || 0 : delaySeconds);

    setIsSending(true);

    try {
      // Ensure permission first
      const perm = await getNotificationPermissions();
      if (!perm?.granted) {
        const req = await requestNotificationPermissions();
        setPermissionStatus(req.status);
        if (!req.granted) {
          Alert.alert(
            'Permission Required',
            'Notification permission was not granted. Notifications may not be shown by the OS.'
          );
        }
      }

      const extraData: Record<string, any> = {};
      if (customDataKey.trim() && customDataVal.trim()) {
        extraData[customDataKey.trim()] = customDataVal.trim();
      }

      const notificationId = await sendLocalNotification({
        title: title.trim(),
        body: body.trim(),
        delaySeconds: effectiveDelay,
        sound: soundEnabled,
        badge: badgeCount,
        route: targetRoute.trim() || undefined,
        data: extraData,
      });

      if (effectiveDelay > 0) {
        showToast(`Scheduled for ${effectiveDelay}s from now! Minimize app to test.`, 'success');
        startCountdown(effectiveDelay);
      } else {
        showToast('Notification sent immediately!', 'success');
      }

      await refreshData();
    } catch (err: any) {
      console.error('Error sending notification:', err);
      showToast(err?.message || 'Failed to send notification', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const startCountdown = (seconds: number) => {
    setActiveCountdown(seconds);
    const interval = setInterval(() => {
      setActiveCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          refreshData();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancelScheduled = async (id: string) => {
    await cancelScheduledNotification(id);
    await refreshData();
    showToast('Scheduled notification cancelled', 'success');
  };

  const handleCancelAllScheduled = async () => {
    await cancelAllScheduledNotifications();
    await refreshData();
    showToast('All scheduled notifications cancelled', 'success');
  };

  const handleClearHistory = async () => {
    await clearNotificationHistory();
    await refreshData();
    showToast('Notification history cleared', 'success');
  };

  const handleDismissAllDelivered = async () => {
    await dismissAllDeliveredNotifications();
    showToast('Dismissed notifications from system tray', 'success');
  };

  const handleResetBadge = async () => {
    await resetBadgeCount();
    showToast('App badge count reset to 0', 'success');
  };

  const handleResendHistory = (item: NotificationHistoryItem) => {
    setTitle(item.title);
    setBody(item.body);
    if (item.route) setTargetRoute(item.route);
    setSoundEnabled(item.sound);
    handleSend(0);
  };

  const isGranted = permissionStatus === 'granted';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notification Lab</Text>
          <Text style={styles.headerSubtitle}>Debug & Test Alert System</Text>
        </View>
        <Pressable
          style={styles.refreshButton}
          onPress={refreshData}
          accessibilityLabel="Refresh"
        >
          <Ionicons name="refresh" size={20} color="#4F46E5" />
        </Pressable>
      </View>

      {/* Floating Feedback Toast */}
      {feedbackMsg && (
        <View style={[
          styles.toastBar,
          feedbackMsg.type === 'error' ? styles.toastBarError : styles.toastBarSuccess
        ]}>
          <Ionicons
            name={feedbackMsg.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.toastText} numberOfLines={2}>
            {feedbackMsg.text}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Permission Status Banner */}
        <View style={[styles.card, styles.permissionCard]}>
          <View style={styles.permissionRow}>
            <View style={styles.permissionInfo}>
              <View style={styles.statusBadgeRow}>
                <View style={[styles.statusIndicator, isGranted ? styles.bgGreen : styles.bgRed]} />
                <Text style={styles.permissionLabel}>
                  System Permission: <Text style={{ fontWeight: '700' }}>{permissionStatus.toUpperCase()}</Text>
                </Text>
              </View>
              <Text style={styles.permissionDesc}>
                {isGranted
                  ? 'Notifications are allowed by device OS. Full alert banner & sound will trigger.'
                  : 'OS notifications disabled. Tap Enable to allow popups & sounds.'}
              </Text>
            </View>
            {!isGranted && (
              <Pressable style={styles.enablePermButton} onPress={handleRequestPermission}>
                <Text style={styles.enablePermText}>Enable</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Quick Presets Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>QUICK PRESETS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsScroll}
          >
            {PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                style={styles.presetChip}
                onPress={() => applyPreset(preset)}
              >
                <View style={[styles.presetIconWrap, { backgroundColor: preset.color }]}>
                  <Ionicons name={preset.icon} size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.presetName}>{preset.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Composer Form Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="create-outline" size={18} color="#4F46E5" />
            <Text style={styles.cardTitle}>Notification Composer</Text>
          </View>

          {/* Title Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. 🏡 New Match in Bandra"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Body Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Message Body</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={body}
              onChangeText={setBody}
              placeholder="Enter notification message text..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Deep Link Route */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Deep Link / Tap Destination Route</Text>
            <TextInput
              style={styles.textInput}
              value={targetRoute}
              onChangeText={setTargetRoute}
              placeholder="e.g. /(broker)/my-listings"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
            />
            {/* Quick Route Suggestions */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.routeChipsRow}>
              {ROUTE_SUGGESTIONS.map((item) => {
                const isSelected = targetRoute === item.route;
                return (
                  <Pressable
                    key={item.label}
                    style={[styles.routeChip, isSelected && styles.routeChipSelected]}
                    onPress={() => setTargetRoute(item.route)}
                  >
                    <Text style={[styles.routeChipText, isSelected && styles.routeChipTextSelected]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Delay / Scheduling Selector */}
          <View style={styles.inputGroup}>
            <View style={styles.labelWithHint}>
              <Text style={styles.inputLabel}>Delivery Delay</Text>
              <Text style={styles.hintText}>Use 5s or 10s to test while app is in background</Text>
            </View>
            <View style={styles.delayChipsRow}>
              {DELAY_OPTIONS.map((sec) => {
                const isSelected = delaySeconds === sec && !customDelay;
                return (
                  <Pressable
                    key={sec}
                    style={[styles.delayChip, isSelected && styles.delayChipSelected]}
                    onPress={() => {
                      setDelaySeconds(sec);
                      setCustomDelay('');
                    }}
                  >
                    <Text style={[styles.delayChipText, isSelected && styles.delayChipTextSelected]}>
                      {sec === 0 ? 'Immediate' : `${sec}s`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Options: Sound & Badge */}
          <View style={styles.optionsDivider} />
          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Ionicons name="volume-high-outline" size={18} color="#475569" />
              <Text style={styles.switchLabel}>Play Alert Sound</Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
              thumbColor={soundEnabled ? '#4F46E5' : '#F3F4F6'}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Ionicons name="notifications-circle-outline" size={18} color="#475569" />
              <Text style={styles.switchLabel}>Badge Increment (+1)</Text>
            </View>
            <Switch
              value={badgeCount !== undefined && badgeCount > 0}
              onValueChange={(val) => setBadgeCount(val ? 1 : undefined)}
              trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
              thumbColor={badgeCount ? '#4F46E5' : '#F3F4F6'}
            />
          </View>

          {/* Custom Key-Value Data (Optional) */}
          <View style={styles.optionsDivider} />
          <Text style={[styles.inputLabel, { marginBottom: 6 }]}>Custom Payload Data (Optional)</Text>
          <View style={styles.keyValueRow}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              value={customDataKey}
              onChangeText={setCustomDataKey}
              placeholder="Key (e.g. property_id)"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              value={customDataVal}
              onChangeText={setCustomDataVal}
              placeholder="Value (e.g. 42)"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {/* Immediate Send Button */}
            <Pressable
              style={styles.primarySendButton}
              onPress={() => handleSend(0)}
              disabled={isSending}
            >
              {isSending && delaySeconds === 0 ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                  <Text style={styles.primarySendText}>Send Notification Now</Text>
                </>
              )}
            </Pressable>

            {/* Background 5-Second Test Button */}
            <Pressable
              style={styles.secondaryScheduleButton}
              onPress={() => handleSend(5)}
              disabled={isSending || activeCountdown !== null}
            >
              <Ionicons name="timer-outline" size={18} color="#4F46E5" />
              <Text style={styles.secondaryScheduleText}>
                {activeCountdown !== null
                  ? `Firing in ${activeCountdown}s... (Minimize app now!)`
                  : 'Test 5-Second Delay (Switch App to Test)'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Scheduled Notifications Queue */}
        {scheduledRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>
                SCHEDULED QUEUE ({scheduledRequests.length})
              </Text>
              <Pressable onPress={handleCancelAllScheduled}>
                <Text style={styles.clearText}>Cancel All</Text>
              </Pressable>
            </View>
            {scheduledRequests.map((req) => (
              <View key={req.identifier} style={styles.scheduledItem}>
                <View style={styles.scheduledInfo}>
                  <Text style={styles.scheduledTitle}>{req.content.title || 'Untitled'}</Text>
                  <Text style={styles.scheduledBody} numberOfLines={1}>{req.content.body}</Text>
                </View>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => handleCancelScheduled(req.identifier)}
                >
                  <Ionicons name="close-circle" size={20} color="#DC2626" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Sent History Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>
              RECENT DISPATCH HISTORY ({history.length})
            </Text>
            {history.length > 0 && (
              <Pressable onPress={handleClearHistory}>
                <Text style={styles.clearText}>Clear History</Text>
              </Pressable>
            )}
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyHistoryBox}>
              <Ionicons name="notifications-off-outline" size={28} color="#9CA3AF" />
              <Text style={styles.emptyHistoryText}>No notifications sent yet</Text>
            </View>
          ) : (
            history.map((item) => (
              <View key={item.id + item.sentAt} style={styles.historyCard}>
                <View style={styles.historyTopRow}>
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.historyTime}>
                    {new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.historyBody} numberOfLines={2}>
                  {item.body}
                </Text>
                {item.route ? (
                  <View style={styles.historyRoutePill}>
                    <Ionicons name="link" size={12} color="#4F46E5" />
                    <Text style={styles.historyRouteText}>{item.route}</Text>
                  </View>
                ) : null}
                <View style={styles.historyFooter}>
                  <Text style={styles.historyDelayTag}>
                    {item.delaySeconds > 0 ? `⏱️ Delay ${item.delaySeconds}s` : '⚡ Immediate'}
                  </Text>
                  <Pressable
                    style={styles.resendButton}
                    onPress={() => handleResendHistory(item)}
                  >
                    <Ionicons name="refresh" size={13} color="#4F46E5" />
                    <Text style={styles.resendText}>Re-send</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* System Utility Tools */}
        <View style={styles.systemToolsCard}>
          <Text style={styles.systemToolsTitle}>SYSTEM UTILITIES</Text>
          <View style={styles.utilityButtonsRow}>
            <Pressable style={styles.utilityButton} onPress={handleDismissAllDelivered}>
              <Ionicons name="trash-outline" size={16} color="#475569" />
              <Text style={styles.utilityButtonText}>Dismiss System Tray</Text>
            </Pressable>
            <Pressable style={styles.utilityButton} onPress={handleResetBadge}>
              <Ionicons name="ellipse-outline" size={16} color="#475569" />
              <Text style={styles.utilityButtonText}>Reset Badge (0)</Text>
            </Pressable>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  toastBar: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toastBarSuccess: {
    backgroundColor: '#059669',
  },
  toastBarError: {
    backgroundColor: '#DC2626',
  },
  toastText: {
    flex: 1,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  permissionCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  permissionInfo: {
    flex: 1,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bgGreen: {
    backgroundColor: '#10B981',
  },
  bgRed: {
    backgroundColor: '#EF4444',
  },
  permissionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: '#334155',
  },
  permissionDesc: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  enablePermButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  enablePermText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    color: '#6B7280',
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 8,
  },
  clearText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  presetsScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  presetIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cardTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 6,
  },
  labelWithHint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  hintText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#6B7280',
  },
  textInput: {
    fontFamily: Fonts.sans,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  routeChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  routeChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 6,
  },
  routeChipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  routeChipText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: '#4B5563',
  },
  routeChipTextSelected: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  delayChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  delayChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 9,
    borderRadius: 8,
  },
  delayChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
  },
  delayChipText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  delayChipTextSelected: {
    color: '#FFFFFF',
  },
  optionsDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#374151',
  },
  keyValueRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  actionsContainer: {
    gap: 10,
    marginTop: 8,
  },
  primarySendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primarySendText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryScheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  secondaryScheduleText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#4338CA',
  },
  scheduledItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  scheduledInfo: {
    flex: 1,
  },
  scheduledTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  scheduledBody: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  cancelButton: {
    padding: 4,
  },
  emptyHistoryBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    gap: 6,
  },
  emptyHistoryText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#9CA3AF',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  historyTime: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: '#9CA3AF',
  },
  historyBody: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
    marginBottom: 6,
  },
  historyRoutePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    marginBottom: 8,
  },
  historyRouteText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: '#4F46E5',
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  historyDelayTag: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#6B7280',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  resendText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
  },
  systemToolsCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  systemToolsTitle: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    color: '#64748B',
    letterSpacing: 0.8,
    fontWeight: '700',
    marginBottom: 10,
  },
  utilityButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  utilityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  utilityButtonText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
});
