import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { storage } from '../lib/storage';
import { safeGoBack } from '../lib/utils';
import { Fonts } from '../constants/theme';

interface AgencyUser {
  id: string;
  full_name: string;
  email: string;
  mobile?: string;
  city?: string;
  is_active: boolean;
  created_at: string;
}

interface AgencyInvitation {
  id: string;
  agency_id: string;
  agency_name: string;
  inviter_name?: string;
  invited_email: string;
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  created_at: string;
  expires_at: string;
  accepted_at?: string;
}

export default function AgencyTeamScreen() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<AgencyUser[]>([]);
  const [invites, setInvites] = useState<AgencyInvitation[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const uStr = await storage.get('user');
      if (uStr) {
        const u = JSON.parse(uStr);
        setCurrentUser(u);
      }

      await Promise.all([fetchUsers(), fetchInvites(), fetchSubscription()]);
    } catch (err) {
      console.error('Failed to load agency team data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/agency/users');
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      console.warn('Failed to fetch agency users:', e?.response?.data || e.message);
    }
  };

  const fetchInvites = async () => {
    try {
      const res = await api.get('/agency/invites');
      setInvites(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      console.warn('Failed to fetch agency invites:', e?.response?.data || e.message);
    }
  };

  const fetchSubscription = async () => {
    try {
      const res = await api.get('/broker/subscription');
      if (res.data?.subscription) {
        setSubscription(res.data.subscription);
      }
    } catch (e: any) {
      console.warn('Failed to fetch subscription:', e?.response?.data || e.message);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchUsers(), fetchInvites(), fetchSubscription()]);
    setRefreshing(false);
  };

  // Seat calculations
  const pendingInvites = useMemo(() => {
    return invites.filter((inv) => {
      if (inv.status !== 'pending') return false;
      if (!inv.expires_at) return true;
      return new Date(inv.expires_at) > new Date();
    });
  }, [invites]);

  const seatLimit =
    (subscription?.included_users ?? 5) + (subscription?.extra_users ?? 0);
  const activeMembersCount = users.filter((u) => u.is_active).length;
  const pendingCount = pendingInvites.length;
  const totalUsedAndReserved = 1 + activeMembersCount + pendingCount;
  const seatsRemaining = Math.max(0, seatLimit - totalUsedAndReserved);
  const seatPct = Math.min(100, Math.round((totalUsedAndReserved / seatLimit) * 100));
  const isSeatsFull = totalUsedAndReserved >= seatLimit;

  // Filtered roster
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.mobile?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleOpenInvite = () => {
    if (isSeatsFull) {
      Alert.alert(
        'Seat Limit Reached',
        `Your Enterprise plan allows up to ${seatLimit} seats. You currently have ${activeMembersCount + 1} active members and ${pendingCount} pending invitations. Purchase additional seats or revoke a pending invitation to invite more.`
      );
      return;
    }
    setInviteEmail('');
    setShowInviteModal(true);
  };

  const handleSendInvite = async () => {
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setSendingInvite(true);
    try {
      const res = await api.post('/agency/invite', { email: cleanEmail });
      Alert.alert(
        'Invitation Sent! ✉️',
        `An invitation link has been emailed to ${cleanEmail}.\n\nWhen they click the link, they will complete their own broker profile and verification, and will automatically be linked to ${
          currentUser?.agency_name || 'your agency'
        }.`,
        [{ text: 'Done', style: 'default' }]
      );
      setShowInviteModal(false);
      setInviteEmail('');
      fetchInvites();
      fetchUsers();
      fetchSubscription();
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        'Failed to send invitation. Please try again.';
      Alert.alert('Unable to Send Invite', errMsg);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevokeInvite = (invite: AgencyInvitation) => {
    Alert.alert(
      'Revoke Invitation',
      `Cancel the pending invitation sent to ${invite.invited_email}? This will free up 1 seat immediately.`,
      [
        { text: 'No, Keep', style: 'cancel' },
        {
          text: 'Revoke Invite',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/agency/invites/${invite.id}`);
              Alert.alert('Invitation Revoked', `The invitation for ${invite.invited_email} was cancelled.`);
              fetchInvites();
              fetchSubscription();
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to revoke invite.');
            }
          },
        },
      ]
    );
  };

  const handleResendInvite = async (invite: AgencyInvitation) => {
    try {
      await api.post('/agency/invite', { email: invite.invited_email });
      Alert.alert('Invitation Resent', `A fresh invitation link was sent to ${invite.invited_email}`);
      fetchInvites();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to resend invitation.');
    }
  };

  const handleRemoveMember = (user: AgencyUser) => {
    Alert.alert(
      'Remove Team Member',
      `Are you sure you want to remove ${user.full_name} (${user.email}) from ${
        currentUser?.agency_name || 'your agency'
      }? They will return to an individual broker account and 1 seat will be freed up.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/agency/users/${user.id}`);
              Alert.alert('Member Removed', `${user.full_name} was unlinked from the agency.`);
              fetchUsers();
              fetchSubscription();
            } catch (err: any) {
              const errMsg =
                err?.response?.data?.error || 'Failed to remove user. Please try again.';
              Alert.alert('Error', errMsg);
            }
          },
        },
      ]
    );
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'AG';
  };

  const formatShortDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack('/profile')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Agency Team</Text>
          <Text style={styles.headerSubtitle}>
            {currentUser?.agency_name || 'Apex Realty Partners'}
          </Text>
        </View>
        <Pressable
          style={[styles.headerAddBtn, isSeatsFull && styles.headerAddBtnDisabled]}
          onPress={handleOpenInvite}
        >
          <Ionicons name="mail-outline" size={16} color="#FFFFFF" />
          <Text style={styles.headerAddBtnText}>Invite</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading team details...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563EB" />
          }
        >
          {/* Seat Capacity Card */}
          <View style={styles.seatCard}>
            <View style={styles.seatHeaderRow}>
              <View style={styles.seatTitleWrapper}>
                <View style={styles.agencyIconCircle}>
                  <Ionicons name="business" size={20} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.seatCardTitle}>Enterprise Seats</Text>
                  <Text style={styles.seatCardAgencyName}>
                    {currentUser?.agency_name || 'Apex Realty Partners'}
                  </Text>
                </View>
              </View>
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>ENTERPRISE</Text>
              </View>
            </View>

            <View style={styles.seatUsageRow}>
              <View>
                <Text style={styles.seatBigNumber}>
                  {totalUsedAndReserved} <Text style={styles.seatBigTotal}>/ {seatLimit}</Text>
                </Text>
                <Text style={styles.seatUsageLabel}>
                  {1 + activeMembersCount} Active • {pendingCount} Pending
                </Text>
              </View>
              <View style={styles.seatRemainingBadge}>
                <Ionicons
                  name={seatsRemaining > 0 ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={seatsRemaining > 0 ? '#16A34A' : '#DC2626'}
                />
                <Text
                  style={[
                    styles.seatRemainingText,
                    { color: seatsRemaining > 0 ? '#16A34A' : '#DC2626' },
                  ]}
                >
                  {seatsRemaining > 0 ? `${seatsRemaining} seats available` : 'All seats reserved'}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${seatPct}%`,
                    backgroundColor: isSeatsFull ? '#EF4444' : '#2563EB',
                  },
                ]}
              />
            </View>

            <Text style={styles.seatHelpText}>
              Send email invites to brokers. Each invited member completes their own verification and automatically receives Enterprise agency perks.
            </Text>
          </View>

          {/* Quick Action Invite Banner */}
          {!isSeatsFull && (
            <Pressable style={styles.quickAddBanner} onPress={handleOpenInvite}>
              <View style={styles.quickAddIconCircle}>
                <Ionicons name="mail" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickAddTitle}>Invite New Agent</Text>
                <Text style={styles.quickAddSub}>Send an email invite link to join your agency</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#2563EB" />
            </Pressable>
          )}

          {/* Pending Invitations Section */}
          {pendingInvites.length > 0 && (
            <View style={styles.pendingSectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  Pending Invites ({pendingInvites.length})
                </Text>
                <Text style={styles.sectionSub}>Awaiting Registration</Text>
              </View>

              {pendingInvites.map((inv) => (
                <View key={inv.id} style={styles.pendingCard}>
                  <View style={styles.pendingIconCircle}>
                    <Ionicons name="mail-unread-outline" size={18} color="#D97706" />
                  </View>
                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingEmail}>{inv.invited_email}</Text>
                    <View style={styles.pendingMetaRow}>
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>INVITE SENT</Text>
                      </View>
                      <Text style={styles.pendingDateText}>
                        Sent {formatShortDate(inv.created_at)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.pendingActions}>
                    <Pressable
                      style={styles.resendBtn}
                      onPress={() => handleResendInvite(inv)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="refresh-outline" size={16} color="#2563EB" />
                    </Pressable>
                    <Pressable
                      style={styles.revokeBtn}
                      onPress={() => handleRevokeInvite(inv)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={18} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Member Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search active team members..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </Pressable>
            )}
          </View>

          {/* Members List Header */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Active Team ({1 + users.length})
            </Text>
            <Text style={styles.sectionSub}>Verified Brokers</Text>
          </View>

          {/* 1. Agency Owner Card (Always on top) */}
          <View style={[styles.memberCard, styles.ownerCard]}>
            <View style={[styles.avatarCircle, { backgroundColor: '#1E40AF' }]}>
              <Text style={styles.avatarInitials}>
                {getInitials(currentUser?.full_name, currentUser?.email)}
              </Text>
            </View>
            <View style={styles.memberInfo}>
              <View style={styles.memberNameRow}>
                <Text style={styles.memberName}>
                  {currentUser?.full_name || 'Agency Owner'}{' '}
                  <Text style={styles.youTag}>(You)</Text>
                </Text>
                <View style={styles.ownerBadge}>
                  <Text style={styles.ownerBadgeText}>OWNER</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="mail-outline" size={14} color="#6B7280" />
                <Text style={styles.metaText}>{currentUser?.email}</Text>
              </View>
              {currentUser?.mobile && (
                <View style={styles.metaRow}>
                  <Ionicons name="call-outline" size={14} color="#6B7280" />
                  <Text style={styles.metaText}>{currentUser?.mobile}</Text>
                </View>
              )}
            </View>
          </View>

          {/* 2. Team Members */}
          {filteredUsers.length > 0 ? (
            filteredUsers.map((member) => (
              <View key={member.id} style={styles.memberCard}>
                <View style={[styles.avatarCircle, { backgroundColor: '#0284C7' }]}>
                  <Text style={styles.avatarInitials}>
                    {getInitials(member.full_name, member.email)}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{member.full_name}</Text>
                    <View style={styles.agentBadge}>
                      <Text style={styles.agentBadgeText}>AGENT</Text>
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="mail-outline" size={14} color="#6B7280" />
                    <Text style={styles.metaText}>{member.email}</Text>
                  </View>
                  {member.mobile && (
                    <View style={styles.metaRow}>
                      <Ionicons name="call-outline" size={14} color="#6B7280" />
                      <Text style={styles.metaText}>{member.mobile}</Text>
                    </View>
                  )}
                  {member.city && (
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={14} color="#6B7280" />
                      <Text style={styles.metaText}>{member.city}</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  style={styles.deleteMemberBtn}
                  onPress={() => handleRemoveMember(member)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                </Pressable>
              </View>
            ))
          ) : users.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="mail-outline" size={30} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyStateTitle}>No Additional Members Yet</Text>
              <Text style={styles.emptyStateSub}>
                You have {seatsRemaining} available seats. Send an invitation link to onboard your agents under your agency license.
              </Text>
              <Pressable style={styles.emptyAddBtn} onPress={handleOpenInvite}>
                <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
                <Text style={styles.emptyAddBtnText}>Send First Invite</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptySearchContainer}>
              <Text style={styles.emptySearchText}>No active members match "{search}"</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Send Invite Modal */}
      <Modal
        visible={showInviteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalHeaderIconCircle}>
                  <Ionicons name="mail" size={18} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Invite Team Member</Text>
                  <Text style={styles.modalSubtitle}>
                    {currentUser?.agency_name || 'Apex Realty Partners'}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowInviteModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Agent's Email Address <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. agent@example.com"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                />
              </View>

              <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={18} color="#2563EB" />
                <Text style={styles.infoBannerText}>
                  An invitation link will be sent to this email. The broker will register with their own name, phone, password, and complete standard broker verification.
                </Text>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowInviteModal(false)}
                disabled={sendingInvite}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmitBtn, sendingInvite && styles.modalSubmitBtnDisabled]}
                onPress={handleSendInvite}
                disabled={sendingInvite}
              >
                {sendingInvite ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={15} color="#FFFFFF" />
                    <Text style={styles.modalSubmitBtnText}>Send Invite</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontFamily: Fonts.sans,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts.sansBold,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: Fonts.sans,
    marginTop: 1,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  headerAddBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Fonts.sansSemiBold,
  },
  scrollContent: {
    padding: 16,
  },

  /* Seat Capacity Card */
  seatCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  seatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seatTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  agencyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts.sansBold,
  },
  seatCardAgencyName: {
    fontSize: 12,
    color: '#4B5563',
    fontFamily: Fonts.sansMedium,
  },
  planBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7E22CE',
    fontFamily: Fonts.sansBold,
    letterSpacing: 0.5,
  },
  seatUsageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  seatBigNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    fontFamily: Fonts.sansBold,
  },
  seatBigTotal: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  seatUsageLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: Fonts.sans,
    marginTop: 2,
  },
  seatRemainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  seatRemainingText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts.sansSemiBold,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  seatHelpText: {
    fontSize: 11.5,
    color: '#6B7280',
    lineHeight: 16,
    fontFamily: Fonts.sans,
  },

  /* Quick Add Banner */
  quickAddBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 12,
  },
  quickAddIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
    fontFamily: Fonts.sansBold,
  },
  quickAddSub: {
    fontSize: 11.5,
    color: '#3B82F6',
    fontFamily: Fonts.sans,
    marginTop: 1,
  },

  /* Pending Section */
  pendingSectionContainer: {
    marginBottom: 16,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingEmail: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#92400E',
    fontFamily: Fonts.sansBold,
  },
  pendingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  pendingBadge: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  pendingBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#78350F',
    letterSpacing: 0.5,
  },
  pendingDateText: {
    fontSize: 11,
    color: '#B45309',
    fontFamily: Fonts.sans,
  },
  pendingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resendBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  revokeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },

  /* Search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    fontFamily: Fonts.sans,
  },

  /* Section Header */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    fontFamily: Fonts.sansBold,
  },
  sectionSub: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: Fonts.sans,
  },

  /* Member Cards */
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ownerCard: {
    borderColor: '#BFDBFE',
    backgroundColor: '#FAFCFF',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Fonts.sansBold,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  memberName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts.sansBold,
  },
  youTag: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2563EB',
  },
  ownerBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ownerBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#1D4ED8',
    fontFamily: Fonts.sansBold,
    letterSpacing: 0.5,
  },
  agentBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  agentBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0369A1',
    fontFamily: Fonts.sansBold,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: Fonts.sans,
  },
  deleteMemberBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    marginLeft: 8,
  },

  /* Empty States */
  emptyStateContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts.sansBold,
    marginBottom: 6,
  },
  emptyStateSub: {
    fontSize: 12.5,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: Fonts.sans,
    marginBottom: 18,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Fonts.sansSemiBold,
  },
  emptySearchContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: Fonts.sans,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalHeaderIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts.sansBold,
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: '#6B7280',
    fontFamily: Fonts.sans,
  },
  modalForm: {
    padding: 18,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    fontFamily: Fonts.sansSemiBold,
  },
  requiredStar: {
    color: '#EF4444',
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    fontFamily: Fonts.sans,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11.5,
    color: '#1E40AF',
    lineHeight: 16,
    fontFamily: Fonts.sans,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 10,
    backgroundColor: '#FAFAFA',
  },
  modalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    fontFamily: Fonts.sansSemiBold,
  },
  modalSubmitBtn: {
    flex: 1.5,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalSubmitBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Fonts.sansSemiBold,
  },
});
