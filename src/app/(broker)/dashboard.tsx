import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storage } from '../../lib/storage';
import { statsStore } from '../../lib/statsStore';
import { router } from 'expo-router';
import api from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { clearSession } from '../../lib/auth';
import { formatPrice } from '../../lib/utils';
import { Fonts } from '../../constants/theme';
import { sendLocalNotification } from '../../lib/notifications';

let memoryRecentListings: any[] | null = null;

export default function BrokerDashboard() {
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const cachedBrokerStats = statsStore.getStats()?.broker;
  const [stats, setStats] = useState(
    cachedBrokerStats || { listings: null as null | number, active: null as null | number, saved: null as null | number }
  );
  const [recentListings, setRecentListings] = useState<any[]>(memoryRecentListings || []);
  const [nlQuery, setNlQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<any>(null);
  const [actingOnInvite, setActingOnInvite] = useState(false);
  const [newTeamMemberAlert, setNewTeamMemberAlert] = useState<any>(null);

  const checkPendingAgencyInvite = async () => {
    try {
      const res = await api.get('/agency/invites/my-pending');
      if (res.data && res.data.invite) {
        const inv = res.data.invite;
        setPendingInvite(inv);
        // Fire local notification once per invite
        const notifiedKey = `@notified_invite_${inv.id}`;
        const alreadyNotified = await storage.get(notifiedKey);
        if (!alreadyNotified) {
          await storage.set(notifiedKey, 'true');
          sendLocalNotification({
            title: `🏢 Agency Invitation: ${inv.agency_name}`,
            body: `${inv.inviter_name || 'An agency admin'} invited you to join ${inv.agency_name} under their Enterprise license. Tap to view.`,
          }).catch(() => {});
        }
      } else {
        setPendingInvite(null);
      }
    } catch {
      // ignore
    }
  };

  const checkAgencyOwnerNotifications = async () => {
    try {
      const userStr = await storage.get('user');
      if (!userStr) return;
      const u = JSON.parse(userStr);
      if (u.plan !== 'enterprise' || !u.is_admin) return;

      const res = await api.get('/agency/notifications/recent-joined');
      const recentList = res.data?.recent_joined || [];
      if (recentList.length > 0) {
        const latest = recentList[0];
        const storageKey = `@owner_notified_joined_${latest.id}`;
        const alreadyNotified = await storage.get(storageKey);
        if (!alreadyNotified) {
          await storage.set(storageKey, 'true');
          sendLocalNotification({
            title: '🔔 New Team Member Joined',
            body: `${latest.member_name} has accepted your invitation and joined ${latest.agency_name}.`,
            route: '/agency-team',
          }).catch(() => {});
          setNewTeamMemberAlert(latest);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleAcceptAgencyInvite = () => {
    if (!pendingInvite) return;
    Alert.alert(
      `Join ${pendingInvite.agency_name}?`,
      `You are accepting an invitation from ${pendingInvite.inviter_name || 'the agency admin'}.\n\nYour account will be linked to ${pendingInvite.agency_name} and upgraded to the Enterprise plan (40 listings, 8 photos/listing, verified agency badge).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept & Join',
          style: 'default',
          onPress: async () => {
            setActingOnInvite(true);
            try {
              const res = await api.post('/agency/invites/accept', { token: pendingInvite.token });
              if (res.data && res.data.user) {
                await storage.set('user', JSON.stringify(res.data.user));
                setUser(res.data.user);
              }
              setPendingInvite(null);
              Alert.alert(
                '🎉 Welcome to the Agency!',
                `You have successfully joined ${pendingInvite.agency_name} on the Enterprise plan.`
              );
              fetchData();
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to accept invitation.');
            } finally {
              setActingOnInvite(false);
            }
          },
        },
      ]
    );
  };

  const handleDeclineAgencyInvite = () => {
    if (!pendingInvite) return;
    Alert.alert(
      'Decline Invitation',
      `Are you sure you want to decline the invitation to join ${pendingInvite.agency_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActingOnInvite(true);
            try {
              await api.post('/agency/invites/decline', { token: pendingInvite.token });
              setPendingInvite(null);
              Alert.alert('Invitation Declined', 'The agency invitation has been declined.');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to decline invitation.');
            } finally {
              setActingOnInvite(false);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    async function loadData() {
      const userStr = await storage.get('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
      }
      checkPendingAgencyInvite();
      checkAgencyOwnerNotifications();
    }
    loadData();

    const unsubscribe = statsStore.subscribe((allStats) => {
      if (allStats?.broker) {
        setStats(allStats.broker);
      }
    });

    statsStore.init().then((initial) => {
      if (initial?.broker) {
        setStats(initial.broker);
      }
      if (!initial?.broker || statsStore.isStale()) {
        fetchData();
      } else {
        // Quietly fetch recent listings for preview
        api.get('/properties/my')
          .then((res) => {
            const slice = res.data.slice(0, 3);
            memoryRecentListings = slice;
            setRecentListings(slice);
          })
          .catch(() => {});
      }
    });

    return unsubscribe;
  }, []);

  const fetchData = async () => {
    try {
      const [listingsRes, savedRes] = await Promise.all([
        api.get('/properties/my'),
        api.get('/saved'),
      ]);
      const listings = listingsRes.data;
      const newStats = {
        listings: listings.length,
        active: listings.filter((p: any) => p.status === 'active').length,
        saved: savedRes.data.length,
      };
      statsStore.setBrokerStats(newStats);
      setStats(newStats);
      const slice = listings.slice(0, 3);
      memoryRecentListings = slice;
      setRecentListings(slice);
    } catch (e) {
      console.log('Failed to fetch broker stats', e);
      if (!statsStore.getStats()?.broker) {
        setStats({ listings: 0, active: 0, saved: 0 });
      }
    }
  };

  const handleSearch = () => {
    router.push({ pathname: '/search', params: { q: nlQuery.trim() } });
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    checkPendingAgencyInvite();
    checkAgencyOwnerNotifications();
    fetchData().finally(() => setRefreshing(false));
  }, []);

  const firstName = user?.full_name?.trim()
    ? user.full_name.trim().split(/\s+/)[0]
    : (user?.first_name || (user?.email ? user.email.split('@')[0] : ''));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.logoText, { marginBottom: 0 }]}>kobrokr</Text>
            <Pressable onPress={() => router.push('/profile')} style={{ padding: 4 }}>
              <Ionicons name="person-circle-outline" size={32} color="#111827" />
            </Pressable>
          </View>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            {t('brokerDashboard.greeting')}{firstName ? `, ${firstName}` : ''} 👋
          </Text>
          <Text style={styles.subtitle}>{t('brokerDashboard.subtitle')}</Text>
        </View>

        {/* Pending Agency Invitation Notice for this Broker */}
        {pendingInvite && (
          <View style={styles.inviteNoticeCard}>
            <View style={styles.inviteNoticeHeader}>
              <View style={styles.inviteNoticeIconCircle}>
                <Ionicons name="business" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteNoticeTag}>AGENCY INVITATION</Text>
                <Text style={styles.inviteNoticeTitle}>Join {pendingInvite.agency_name}</Text>
              </View>
            </View>
            <Text style={styles.inviteNoticeBody}>
              {pendingInvite.inviter_name ? `${pendingInvite.inviter_name} has invited you` : 'You have been invited'} to join <Text style={{ fontWeight: '700' }}>{pendingInvite.agency_name}</Text> under their Enterprise license. You'll get 40 active listings, 8 photos/listing, and the official agency badge on all your properties.
            </Text>
            <View style={styles.inviteNoticeActions}>
              <Pressable 
                style={styles.inviteAcceptBtn}
                onPress={handleAcceptAgencyInvite}
                disabled={actingOnInvite}
              >
                {actingOnInvite ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={styles.inviteAcceptBtnText}>Accept & Join</Text>
                  </>
                )}
              </Pressable>
              <Pressable 
                style={styles.inviteDeclineBtn}
                onPress={handleDeclineAgencyInvite}
                disabled={actingOnInvite}
              >
                <Text style={styles.inviteDeclineBtnText}>Decline</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Success Alert Banner for Agency Owner when a team member joins */}
        {newTeamMemberAlert && (
          <View style={styles.memberJoinedCard}>
            <View style={styles.memberJoinedHeader}>
              <View style={styles.memberJoinedIconCircle}>
                <Ionicons name="people" size={20} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberJoinedTag}>NEW TEAM MEMBER JOINED</Text>
                <Text style={styles.memberJoinedTitle}>{newTeamMemberAlert.member_name} joined your agency</Text>
              </View>
              <Pressable onPress={() => setNewTeamMemberAlert(null)} hitSlop={10}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </Pressable>
            </View>
            <Text style={styles.memberJoinedBody}>
              <Text style={{ fontWeight: '700' }}>{newTeamMemberAlert.member_name}</Text> ({newTeamMemberAlert.member_email}) has accepted your invitation and joined <Text style={{ fontWeight: '700' }}>{newTeamMemberAlert.agency_name}</Text>. They now have Enterprise perks on their account.
            </Text>
            <Text style={styles.memberJoinedNote}>
              💡 If this was sent by mistake, you can tap <Text style={{ fontWeight: '600' }}>Manage Team</Text> to remove this member at any time.
            </Text>
            <View style={styles.memberJoinedActions}>
              <Pressable 
                style={styles.manageTeamBtn}
                onPress={() => {
                  setNewTeamMemberAlert(null);
                  router.push('/agency-team' as any);
                }}
              >
                <Ionicons name="people-outline" size={16} color="#fff" />
                <Text style={styles.manageTeamBtnText}>Manage Team</Text>
              </Pressable>
              <Pressable 
                style={styles.dismissBtn}
                onPress={() => setNewTeamMemberAlert(null)}
              >
                <Text style={styles.dismissBtnText}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Quick Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={nlQuery}
            onChangeText={setNlQuery}
            placeholder={t('brokerDashboard.searchPlaceholder')}
            placeholderTextColor="#9CA3AF"
          />
          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>{t('common.search')}</Text>
          </Pressable>
        </View>

        {/* Agency Team Banner for Enterprise Admins */}
        {user?.plan === 'enterprise' && Boolean(user?.is_admin || user?.is_agency_owner) && (
          <Pressable
            style={styles.agencyBanner}
            onPress={() => router.push('/agency-team' as any)}
          >
            <View style={styles.agencyBannerIconCircle}>
              <Ionicons name="people" size={20} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.agencyBannerTitle}>Agency Team</Text>
                <View style={styles.agencyBannerBadge}>
                  <Text style={styles.agencyBannerBadgeText}>ENTERPRISE</Text>
                </View>
              </View>
              <Text style={styles.agencyBannerSub} numberOfLines={1}>
                {user?.agency_name ? `${user.agency_name} • ` : ''}Manage seats & members
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>
        )}

        {/* Stat Cards */}
        <View style={styles.statsContainer}>
          <Pressable style={styles.statCard} onPress={() => router.push('/(broker)/my-listings')}>
            <Text style={styles.statLabel}>{t('brokerDashboard.totalListings')}</Text>
            {stats.listings === null ? (
              <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 8 }} />
            ) : (
              <Text style={[styles.statValue, { color: '#2563EB' }]}>{stats.listings}</Text>
            )}
            <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
              <Text style={[styles.badgeText, { color: '#2563EB' }]}>{t('brokerDashboard.view')}</Text>
            </View>
          </Pressable>

          <Pressable style={styles.statCard} onPress={() => router.push('/(broker)/my-listings')}>
            <Text style={styles.statLabel}>{t('brokerDashboard.activeListings')}</Text>
            {stats.active === null ? (
              <ActivityIndicator size="small" color="#16A34A" style={{ marginTop: 8 }} />
            ) : (
              <Text style={[styles.statValue, { color: '#16A34A' }]}>{stats.active}</Text>
            )}
            <View style={[styles.badge, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.badgeText, { color: '#16A34A' }]}>{t('brokerDashboard.view')}</Text>
            </View>
          </Pressable>

          <Pressable style={styles.statCard} onPress={() => router.push('/saved')}>
            <Text style={styles.statLabel}>{t('brokerDashboard.savedProperties')}</Text>
            {stats.saved === null ? (
              <ActivityIndicator size="small" color="#9333EA" style={{ marginTop: 8 }} />
            ) : (
              <Text style={[styles.statValue, { color: '#9333EA' }]}>{stats.saved}</Text>
            )}
            <View style={[styles.badge, { backgroundColor: '#F3E8FF' }]}>
              <Text style={[styles.badgeText, { color: '#9333EA' }]}>{t('brokerDashboard.view')}</Text>
            </View>
          </Pressable>
        </View>

        {/* Recent Listings */}
        {recentListings.length > 0 && (
          <View style={styles.recentContainer}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>{t('brokerDashboard.recentListings')}</Text>
              <Text style={styles.recentViewAll}>{t('brokerDashboard.viewAll')}</Text>
            </View>
            <View style={styles.recentList}>
              {recentListings.map((p) => {
                const coverImg = p.property_images?.find((img: any) => img.is_cover)?.url || p.property_images?.[0]?.url;
                return (
                  <Pressable key={p.id} style={styles.propertyCard} onPress={() => router.push(`/properties/${p.id}`)}>
                    <View style={styles.propertyDetails}>
                      <Text style={styles.propertyTitle} numberOfLines={1}>{p.title}</Text>
                      <Text style={styles.propertyLocality}>{p.locality}, {p.city}</Text>
                    </View>
                    <View style={styles.propertyPriceContainer}>
                      <Text style={styles.propertyPrice}>{formatPrice(p.price)}</Text>
                      <View style={[
                        styles.statusBadge, 
                        p.status === 'active' ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#F3F4F6' }
                      ]}>
                        <Text style={[
                          styles.statusBadgeText,
                          p.status === 'active' ? { color: '#15803D' } : { color: '#6B7280' }
                        ]}>{t(`enums.status.${p.status}`, { defaultValue: p.status })}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        

      </ScrollView>

      {/* Floating Ball: Become a Partner */}
      <Pressable 
        style={styles.floatingPartnerBall} 
        onPress={() => router.push('/partner' as any)}
        accessibilityLabel={t('brokerDashboard.becomePartner')}
        accessibilityRole="button"
      >
        <Ionicons name="briefcase" size={24} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    position: 'relative',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 90,
    flexGrow: 1,
  },
  floatingPartnerBall: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99,
  },
  header: {
    marginBottom: 24,
  },
  logoText: {
    fontFamily: Fonts.display,
    fontSize: 24,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#6B7280',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.sans,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  searchButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  searchButtonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  statLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#6B7280',
  },
  statValue: {
    fontFamily: Fonts.monoMedium,
    fontSize: 28,
    fontWeight: '600',
    marginTop: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    marginTop: 12,
  },
  badgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    fontWeight: '600',
  },
  recentContainer: {
    marginBottom: 24,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  recentViewAll: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#2563EB',
  },
  recentList: {
    gap: 8,
  },
  propertyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
  },
  propertyDetails: {
    flex: 1,
    marginRight: 16,
  },
  propertyTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  propertyLocality: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#9CA3AF',
  },
  propertyPriceContainer: {
    alignItems: 'flex-end',
  },
  propertyPrice: {
    fontFamily: Fonts.monoMedium,
    fontSize: 14,
    fontWeight: '600',
    color: '#1D4ED8',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  statusBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  logoutButton: {
    marginTop: 12,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  agencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  agencyBannerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agencyBannerTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  agencyBannerBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  agencyBannerBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 9,
    fontWeight: '700',
    color: '#7E22CE',
    letterSpacing: 0.5,
  },
  agencyBannerSub: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    color: '#6B7280',
    marginTop: 1,
  },
  inviteNoticeCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  inviteNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  inviteNoticeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteNoticeTag: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 0.8,
  },
  inviteNoticeTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  inviteNoticeBody: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 14,
  },
  inviteNoticeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inviteAcceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
  },
  inviteAcceptBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inviteDeclineBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteDeclineBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#64748B',
  },
  memberJoinedCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  memberJoinedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  memberJoinedIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberJoinedTag: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
    letterSpacing: 0.8,
  },
  memberJoinedTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    fontWeight: '700',
    color: '#14532D',
  },
  memberJoinedBody: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
    marginBottom: 6,
  },
  memberJoinedNote: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 16,
  },
  memberJoinedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  manageTeamBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: 8,
  },
  manageTeamBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dismissBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#64748B',
  },
});
