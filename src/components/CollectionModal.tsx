import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import api from '../lib/api';
import { Fonts } from '../constants/theme';

interface CollectionModalProps {
  visible: boolean;
  propertyIds: (string | number)[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function CollectionModal({
  visible,
  propertyIds,
  onClose,
  onSuccess,
}: CollectionModalProps) {
  const { t } = useTranslation();
  const [collections, setCollections] = useState<any[]>([]);
  const [limits, setLimits] = useState<{ collection_limit: number; collection_property_limit: number }>({
    collection_limit: 2,
    collection_property_limit: 5,
  });
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingLoading, setCreatingLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && propertyIds.length > 0) {
      loadData();
    } else {
      setIsCreating(false);
      setNewCollectionName('');
      setError('');
    }
  }, [visible, propertyIds]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [colRes, limitsRes] = await Promise.allSettled([
        api.get('/collections'),
        api.get('/properties/limits'),
      ]);

      if (colRes.status === 'fulfilled') {
        setCollections(Array.isArray(colRes.value.data) ? colRes.value.data : []);
      }
      if (limitsRes.status === 'fulfilled' && limitsRes.value.data) {
        setLimits({
          collection_limit: limitsRes.value.data.collection_limit ?? 2,
          collection_property_limit: limitsRes.value.data.collection_property_limit ?? 5,
        });
      }
    } catch (e: any) {
      setError(t('library.failedLoadCollections', { defaultValue: 'Failed to load collections' }));
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCollection = async (collectionId: number) => {
    setSavingId(collectionId);
    setError('');
    try {
      await api.post(`/collections/${collectionId}/properties`, {
        property_ids: propertyIds,
      });
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('library.addedToCollection', { defaultValue: 'Properties added to collection!' })
      );
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.error || t('library.failedCollection', { defaultValue: 'Failed to add to collection' });
      setError(msg);
      Alert.alert(t('common.error', { defaultValue: 'Error' }), msg);
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateAndAdd = async () => {
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;

    // Check limit
    if (limits.collection_limit >= 0 && collections.length >= limits.collection_limit) {
      Alert.alert(
        'Collection Limit Reached',
        `You have reached the free limit of ${limits.collection_limit} collections. Upgrade to Pro for unlimited collections.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Plans',
            onPress: () => {
              onClose();
              router.push('/profile');
            },
          },
        ]
      );
      return;
    }

    setCreatingLoading(true);
    setError('');
    try {
      const { data: newCol } = await api.post('/collections', { name: trimmed });
      if (newCol?.id) {
        await api.post(`/collections/${newCol.id}/properties`, {
          property_ids: propertyIds,
        });
      }
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('library.addedToCollection', { defaultValue: 'Collection created and properties added!' })
      );
      setNewCollectionName('');
      setIsCreating(false);
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.error || t('library.failedCollection', { defaultValue: 'Failed to create collection' });
      setError(msg);
      Alert.alert(t('common.error', { defaultValue: 'Error' }), msg);
    } finally {
      setCreatingLoading(false);
    }
  };

  const isLimitReached = limits.collection_limit >= 0 && collections.length >= limits.collection_limit;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{t('library.addToCollection', { defaultValue: 'Add to Collection' })}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {propertyIds.length} {propertyIds.length === 1 ? 'item' : 'items'}
                  </Text>
                </View>
              </View>
              <Text style={styles.subtitle}>
                Save shortlisted properties to your custom collections
              </Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color="#64748B" />
            </Pressable>
          </View>

          {/* Error Banner */}
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Body */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Loading your collections...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollList}
              contentContainerStyle={styles.scrollListContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Existing Collections List */}
              {collections.length > 0 ? (
                <View style={styles.collectionsList}>
                  {collections.map((col) => {
                    const currentCount = col.property_ids?.length || 0;
                    const maxProp = limits.collection_property_limit;
                    const isFull = maxProp >= 0 && currentCount + propertyIds.length > maxProp;
                    const isSaving = savingId === col.id;

                    return (
                      <View key={col.id} style={styles.collectionItem}>
                        <View style={styles.colIconWrapper}>
                          <Ionicons name="folder" size={22} color="#2563EB" />
                        </View>
                        <View style={styles.colInfo}>
                          <Text style={styles.colName} numberOfLines={1}>{col.name}</Text>
                          <Text style={styles.colMeta}>
                            {currentCount} / {maxProp >= 0 ? maxProp : '∞'} properties
                          </Text>
                        </View>

                        <Pressable
                          style={[
                            styles.colAddBtn,
                            isFull && styles.colAddBtnFull,
                            isSaving && { opacity: 0.7 },
                          ]}
                          disabled={isFull || isSaving}
                          onPress={() => handleAddToCollection(col.id)}
                        >
                          {isSaving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text
                              style={[
                                styles.colAddBtnText,
                                isFull && styles.colAddBtnTextFull,
                              ]}
                            >
                              {isFull ? 'Full' : '+ Add'}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="albums-outline" size={32} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyTitle}>No collections yet</Text>
                  <Text style={styles.emptySub}>
                    Create a collection below to save and organize these properties.
                  </Text>
                </View>
              )}

              {/* Create Collection Section */}
              <View style={styles.createSection}>
                {!isCreating ? (
                  <Pressable
                    style={[
                      styles.createTriggerBtn,
                      isLimitReached && styles.createTriggerBtnDisabled,
                    ]}
                    onPress={() => {
                      if (isLimitReached) {
                        Alert.alert(
                          'Collection Limit Reached',
                          `You have reached the maximum of ${limits.collection_limit} collections. Upgrade to Pro for unlimited collections.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'View Plans', onPress: () => { onClose(); router.push('/profile'); } },
                          ]
                        );
                      } else {
                        setIsCreating(true);
                      }
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
                    <Text style={styles.createTriggerText}>
                      {t('library.createCollection', { defaultValue: 'Create New Collection' })}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.createForm}>
                    <Text style={styles.createFormLabel}>Collection Name</Text>
                    <TextInput
                      style={styles.createInput}
                      placeholder={t('library.collectionNamePlaceholder', { defaultValue: 'e.g. Bandra 3BHKs' })}
                      placeholderTextColor="#94A3B8"
                      value={newCollectionName}
                      onChangeText={setNewCollectionName}
                      autoFocus
                      maxLength={50}
                    />

                    <View style={styles.createActions}>
                      <Pressable
                        style={styles.cancelBtn}
                        onPress={() => {
                          setIsCreating(false);
                          setNewCollectionName('');
                        }}
                      >
                        <Text style={styles.cancelBtnText}>{t('common.cancel', { defaultValue: 'Cancel' })}</Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.saveNewBtn,
                          (!newCollectionName.trim() || creatingLoading) && styles.saveNewBtnDisabled,
                        ]}
                        disabled={!newCollectionName.trim() || creatingLoading}
                        onPress={handleCreateAndAdd}
                      >
                        {creatingLoading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            <Text style={styles.saveNewBtnText}>Create & Add</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontFamily: Fonts.sansBold,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  countBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  countBadgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  errorText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#DC2626',
    flex: 1,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#64748B',
  },
  scrollList: {
    maxHeight: 400,
  },
  scrollListContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  collectionsList: {
    gap: 10,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  colIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colInfo: {
    flex: 1,
  },
  colName: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  colMeta: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  colAddBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colAddBtnFull: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  colAddBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  colAddBtnTextFull: {
    color: '#94A3B8',
    fontFamily: Fonts.sansMedium,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: '#1E293B',
    marginBottom: 4,
  },
  emptySub: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  createSection: {
    marginTop: 14,
  },
  createTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#BFDBFE',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 14,
  },
  createTriggerBtnDisabled: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    opacity: 0.6,
  },
  createTriggerText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '700',
  },
  createForm: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 14,
    padding: 14,
  },
  createFormLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#334155',
    marginBottom: 6,
  },
  createInput: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    marginBottom: 12,
  },
  createActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#475569',
  },
  saveNewBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveNewBtnDisabled: {
    opacity: 0.5,
  },
  saveNewBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
