import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Linking,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
}

const CATEGORIES = [
  { id: 'feature', label: 'Feature Request', icon: 'bulb-outline' as const },
  { id: 'bug', label: 'Report a Bug', icon: 'bug-outline' as const },
  { id: 'general', label: 'General Feedback', icon: 'chatbubble-ellipses-outline' as const },
];

const RATING_LABELS = ['', 'Needs Improvement', 'Fair', 'Good', 'Very Good', 'Excellent!'];

export default function FeedbackModal({ visible, onClose, userEmail, userName }: FeedbackModalProps) {
  const [category, setCategory] = useState<'feature' | 'bug' | 'general'>('general');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');

  const resetForm = () => {
    setComment('');
    setRating(5);
    setCategory('general');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const formatMessage = () => {
    const catLabel = CATEGORIES.find(c => c.id === category)?.label || 'General Feedback';
    const lines = [
      `Category: ${catLabel}`,
      `Rating: ${rating}/5 (${RATING_LABELS[rating]})`,
      `User: ${userName || 'Anonymous'} (${userEmail || 'N/A'})`,
      `Platform: ${Platform.OS.toUpperCase()} (KoBrokr Mobile App)`,
      '',
      'Comments:',
      comment.trim(),
    ];
    return lines.join('\n');
  };

  const handleSendEmail = async () => {
    if (!comment.trim()) {
      Alert.alert('Please add a comment', 'Tell us what you would like to share or report.');
      return;
    }

    const catLabel = CATEGORIES.find(c => c.id === category)?.label || 'Feedback';
    const subject = encodeURIComponent(`[KoBrokr App ${catLabel}] from ${userName || 'User'}`);
    const body = encodeURIComponent(formatMessage());
    const mailtoUrl = `mailto:support@kobrokr.com?subject=${subject}&body=${body}`;

    try {
      const supported = await Linking.canOpenURL(mailtoUrl);
      if (supported) {
        await Linking.openURL(mailtoUrl);
        handleClose();
      } else {
        await Linking.openURL(`mailto:support@kobrokr.com`);
        handleClose();
      }
    } catch (e) {
      Alert.alert('Feedback Not Sent', 'Could not open your email client. You can email us directly at support@kobrokr.com');
    }
  };

  const handleSendWhatsApp = async () => {
    if (!comment.trim()) {
      Alert.alert('Please add a comment', 'Tell us what you would like to share or report.');
      return;
    }

    const text = encodeURIComponent(`*KoBrokr App Feedback*\n\n${formatMessage()}`);
    const waUrl = `https://wa.me/919820000000?text=${text}`;

    try {
      await Linking.openURL(waUrl);
      handleClose();
    } catch (e) {
      Alert.alert('WhatsApp Error', 'Could not open WhatsApp. You can email us at support@kobrokr.com');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.modalCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Send Feedback</Text>
                <Text style={styles.subtitle}>Help us make KoBrokr better for you</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={handleClose}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {/* Category Selector */}
            <Text style={styles.sectionLabel}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => {
                const active = category === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setCategory(cat.id as any)}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={15}
                      color={active ? '#2563EB' : '#64748B'}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Star Rating */}
            <View style={styles.ratingSection}>
              <View style={styles.ratingHeaderRow}>
                <Text style={styles.sectionLabel}>How is your experience?</Text>
                {rating > 0 && (
                  <Text style={styles.ratingLabelText}>{RATING_LABELS[rating]}</Text>
                )}
              </View>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    onPress={() => setRating(star)}
                    style={styles.starBtn}
                  >
                    <Ionicons
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={32}
                      color={star <= rating ? '#F59E0B' : '#CBD5E1'}
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Comment TextInput */}
            <Text style={styles.sectionLabel}>Your Message</Text>
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={4}
              placeholder="Tell us what you like or report an issue..."
              placeholderTextColor="#94A3B8"
              value={comment}
              onChangeText={setComment}
              textAlignVertical="top"
            />

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <Pressable
                style={styles.whatsappBtn}
                onPress={handleSendWhatsApp}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.whatsappBtnText}>WhatsApp</Text>
              </Pressable>

              <Pressable
                style={styles.emailBtn}
                onPress={handleSendEmail}
              >
                <Ionicons name="mail" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emailBtnText}>Send via Email</Text>
              </Pressable>
            </View>

            <Text style={styles.footerNote}>
              Our team reviews every piece of feedback to improve your experience.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    padding: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  categoryText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#64748B',
  },
  categoryTextActive: {
    fontFamily: Fonts.sansBold,
    color: '#2563EB',
    fontWeight: '700',
  },
  ratingSection: {
    marginBottom: 18,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  ratingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingLabelText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: '#D97706',
    fontWeight: '600',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  starBtn: {
    padding: 4,
  },
  textInput: {
    fontFamily: Fonts.sans,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 100,
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 13,
    borderRadius: 14,
  },
  whatsappBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emailBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 13,
    borderRadius: 14,
  },
  emailBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footerNote: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
});
