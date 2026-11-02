import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import api from '../lib/api';
import { safeGoBack } from '../lib/utils';

interface PaymentRecord {
  id: string;
  broker_id: string;
  subscription_id?: string;
  razorpay_payment_id?: string;
  razorpay_subscription_id?: string;
  razorpay_plan_id?: string;
  amount: number;
  currency: string;
  payment_status: string;
  payment_method?: string;
  invoice_id?: string;
  created_at: string;
}

interface SubscriptionDetails {
  plan?: string;
  status?: string;
  billing_cycle?: string;
  amount?: number;
  renewal_date?: string;
  cancel_at_period_end?: boolean;
}

export default function PaymentHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    try {
      setError('');
      const res = await api.get('/broker/subscription');
      if (res.data) {
        setSubscription(res.data.subscription || null);
        setPayments(res.data.payment_history || []);
      }
    } catch (e: any) {
      console.error('Failed to load payment history:', e);
      setError('Unable to load payment history. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const handleDownloadInvoice = async (item: PaymentRecord) => {
    const invoiceId = item.invoice_id;
    if (!invoiceId) {
      Alert.alert('Invoice Unavailable', 'No tax invoice is associated with this transaction.');
      return;
    }

    try {
      setDownloadingId(item.id);
      const encodedId = encodeURIComponent(invoiceId);
      const res = await api.get(`/payments/invoice/${encodedId}/download`);

      if (res.data && res.data.pdf_url) {
        const canOpen = await Linking.canOpenURL(res.data.pdf_url);
        if (canOpen) {
          await Linking.openURL(res.data.pdf_url);
        } else {
          Alert.alert('Download Error', 'Could not open the invoice file on this device.');
        }
      } else {
        Alert.alert('Invoice Pending', 'The PDF invoice is still being processed. Please try again in a few moments.');
      }
    } catch (err: any) {
      console.error('Invoice download failed:', err);
      const msg = err.response?.data?.error || 'Failed to download the invoice. Please contact support@kobrokr.com.';
      Alert.alert('Download Error', msg);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const formatAmount = (amt: number, currency: string = 'INR') => {
    if (currency === 'INR') {
      return `₹${Number(amt).toLocaleString('en-IN')}`;
    }
    return `${currency} ${amt}`;
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack()} style={styles.backButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Payment History & Invoices</Text>
        <Pressable onPress={onRefresh} style={styles.refreshButton} hitSlop={12}>
          <Ionicons name="refresh-outline" size={22} color="#4B5563" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading payment history…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={36} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={fetchHistory}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Active Subscription Summary Card */}
            {subscription && (
              <View style={styles.planCard}>
                <View style={styles.planCardTop}>
                  <View style={styles.planIconWrapper}>
                    <Ionicons name="shield-checkmark" size={20} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planCardLabel}>CURRENT SUBSCRIPTION</Text>
                    <Text style={styles.planCardTitle}>
                      {subscription.plan
                        ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
                        : 'Starter'}{' '}
                      Plan
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      subscription.status === 'active' ? styles.statusPillActive : styles.statusPillInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        subscription.status === 'active' ? styles.statusPillTextActive : styles.statusPillTextInactive,
                      ]}
                    >
                      {(subscription.status || 'FREE').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {subscription.status === 'active' && subscription.renewal_date && (
                  <View style={styles.planCardMetaRow}>
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text style={styles.planCardMetaText}>
                      {subscription.cancel_at_period_end ? 'Expires on: ' : 'Next renewal: '}
                      {formatDate(subscription.renewal_date)}
                    </Text>
                    {subscription.billing_cycle && (
                      <Text style={styles.planCardCycleBadge}>
                        {subscription.billing_cycle.toUpperCase()}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Transactions Header */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="receipt-outline" size={18} color="#1F2937" />
                <Text style={styles.sectionTitle}>Invoices & Transactions</Text>
              </View>
              <Text style={styles.transactionCount}>
                {payments.length} {payments.length === 1 ? 'record' : 'records'}
              </Text>
            </View>

            {/* Payment History List */}
            {payments.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="receipt-outline" size={32} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>No Invoices Yet</Text>
                <Text style={styles.emptySubtitle}>
                  When you purchase or renew a subscription on kobrokr.com, your payment receipts and downloadable GST tax
                  invoices will appear here.
                </Text>
              </View>
            ) : (
              payments.map((item) => {
                const isPaid = (item.payment_status || '').toLowerCase() === 'paid';
                const isDownloading = downloadingId === item.id;
                const hasInvoice = Boolean(item.invoice_id);

                return (
                  <View key={item.id} style={styles.invoiceCard}>
                    {/* Top Row: Date & Status */}
                    <View style={styles.invoiceCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                        <Text style={styles.invoiceDate}>{formatDate(item.created_at)}</Text>
                      </View>
                      <View
                        style={[
                          styles.paymentStatusBadge,
                          isPaid ? styles.paymentStatusPaid : styles.paymentStatusOther,
                        ]}
                      >
                        <Text
                          style={[
                            styles.paymentStatusText,
                            isPaid ? styles.paymentStatusTextPaid : styles.paymentStatusTextOther,
                          ]}
                        >
                          {(item.payment_status || 'PAID').toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {/* Middle Row: Amount & Payment Details */}
                    <View style={styles.invoiceAmountRow}>
                      <View>
                        <Text style={styles.invoiceAmount}>{formatAmount(item.amount, item.currency)}</Text>
                        <Text style={styles.invoiceMethod}>
                          {item.payment_method || 'Razorpay Subscriptions'}
                        </Text>
                      </View>
                      {item.razorpay_payment_id && (
                        <View style={styles.paymentIdBox}>
                          <Text style={styles.paymentIdLabel}>TXN ID</Text>
                          <Text style={styles.paymentIdValue} numberOfLines={1}>
                            {item.razorpay_payment_id}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Divider */}
                    <View style={styles.invoiceDivider} />

                    {/* Bottom Row: Invoice ID & Download Button */}
                    <View style={styles.invoiceActionRow}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={styles.invoiceNumberLabel}>TAX INVOICE</Text>
                        <Text style={styles.invoiceNumberValue} numberOfLines={1}>
                          {item.invoice_id || 'Generating / Pending'}
                        </Text>
                      </View>

                      {hasInvoice ? (
                        <Pressable
                          style={[styles.downloadBtn, isDownloading && styles.downloadBtnDisabled]}
                          onPress={() => handleDownloadInvoice(item)}
                          disabled={isDownloading}
                        >
                          {isDownloading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="cloud-download-outline" size={15} color="#FFFFFF" />
                              <Text style={styles.downloadBtnText}>Download PDF</Text>
                            </>
                          )}
                        </Pressable>
                      ) : (
                        <View style={styles.pendingBadge}>
                          <Ionicons name="time-outline" size={13} color="#9CA3AF" />
                          <Text style={styles.pendingBadgeText}>Pending</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}

            {/* Compliance Footer Note */}
            <View style={styles.complianceNote}>
              <Ionicons name="information-circle-outline" size={16} color="#6B7280" style={{ marginTop: 1 }} />
              <Text style={styles.complianceNoteText}>
                Invoices include 18% GST (SAC 998434 - Software as a Service) and are generated in compliance with
                Indian tax regulations. Tax invoices are also emailed automatically to your account email.
              </Text>
            </View>
          </>
        )}
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
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 17,
    color: '#111827',
  },
  refreshButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planCardLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  planCardTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: '#111827',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillActive: {
    backgroundColor: '#DCFCE7',
  },
  statusPillInactive: {
    backgroundColor: '#F3F4F6',
  },
  statusPillText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
  },
  statusPillTextActive: {
    color: '#15803D',
  },
  statusPillTextInactive: {
    color: '#6B7280',
  },
  planCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  planCardMetaText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  planCardCycleBadge: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: '#111827',
  },
  transactionCount: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#6B7280',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: '#111827',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
  },
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  invoiceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  invoiceDate: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#4B5563',
  },
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentStatusPaid: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  paymentStatusOther: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentStatusText: {
    fontFamily: Fonts.sansBold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  paymentStatusTextPaid: {
    color: '#047857',
  },
  paymentStatusTextOther: {
    color: '#4B5563',
  },
  invoiceAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  invoiceAmount: {
    fontFamily: Fonts.sansBold,
    fontSize: 20,
    color: '#111827',
  },
  invoiceMethod: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  paymentIdBox: {
    alignItems: 'flex-end',
    maxWidth: '45%',
  },
  paymentIdLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 9,
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  paymentIdValue: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2,
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  invoiceActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  invoiceNumberLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 9,
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  invoiceNumberValue: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    color: '#1F2937',
    marginTop: 2,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  downloadBtnDisabled: {
    opacity: 0.6,
  },
  downloadBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  pendingBadgeText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: '#6B7280',
  },
  complianceNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  complianceNoteText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
    flex: 1,
  },
});
