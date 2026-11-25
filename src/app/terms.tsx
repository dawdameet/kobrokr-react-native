import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { safeGoBack } from '../lib/utils';
import { TERMS_AND_CONDITIONS_TEXT } from '../constants/terms';

interface Section {
  number?: string;
  title: string;
  body: string;
}

export default function TermsAndConditionsScreen() {
  const { preamble, sections, closing } = useMemo(() => {
    // Split into numbered sections (e.g. "1. DEFINITIONS", "2. Acceptance of these Terms", etc.)
    const parts = TERMS_AND_CONDITIONS_TEXT.split(/\n\s*(\d+\.\s+[^\n]+)\n/);
    const rawPreamble = parts[0] || '';

    // Extract preamble body (skipping header title lines)
    const preambleLines = rawPreamble
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // Filter out top 4 meta lines (KOBROKR, www.kobrokr.com, TERMS & CONDITIONS, Last Updated...)
    const preambleBody = preambleLines.slice(4).join('\n\n') || rawPreamble.trim();

    const parsedSections: Section[] = [];
    for (let i = 1; i < parts.length; i += 2) {
      const fullTitle = (parts[i] || '').trim();
      const rawBody = (parts[i + 1] || '').trim();

      // Check if this is the final contact section containing closing footer note
      if (fullTitle.startsWith('30.')) {
        const contactParts = rawBody.split('\n*Kindly note that');
        parsedSections.push({
          title: fullTitle,
          body: (contactParts[0] || '').trim(),
        });
      } else {
        parsedSections.push({
          title: fullTitle,
          body: rawBody,
        });
      }
    }

    const closingNote =
      'Kindly note that the website Kobrokr is owned and operated by ARUYA TECH, a sole proprietorship governed under the laws of India.';

    return {
      preamble: preambleBody,
      sections: parsedSections,
      closing: closingNote,
    };
  }, []);

  const handleOpenWeb = () => {
    Linking.openURL('https://www.kobrokr.com/terms').catch(() => {});
  };

  const handleContactEmail = () => {
    Linking.openURL('mailto:support@kobrokr.com').catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => safeGoBack('/profile')}
          style={styles.backButton}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Terms & Conditions
        </Text>
        <Pressable
          onPress={handleOpenWeb}
          style={styles.webButton}
          hitSlop={10}
        >
          <Ionicons name="open-outline" size={20} color="#2563EB" />
        </Pressable>
      </View>

      {/* Main Document Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Document Header Banner */}
        <View style={styles.docHeader}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>LEGAL AGREEMENT</Text>
            </View>
            <View style={styles.versionBadge}>
              <Text style={styles.versionBadgeText}>Version 1.0</Text>
            </View>
          </View>
          <Text style={styles.docTitle}>Terms & Conditions</Text>
          <Text style={styles.docSubtitle}>
            Last Updated: July 22, 2026 • ARUYA TECH
          </Text>
          <View style={styles.divider} />
        </View>

        {/* Preamble / Introduction */}
        <View style={styles.preambleCard}>
          <View style={styles.preambleHeaderRow}>
            <Ionicons name="information-circle-outline" size={20} color="#2563EB" />
            <Text style={styles.preambleHeading}>Agreement Overview</Text>
          </View>
          <Text style={styles.preambleText}>{preamble}</Text>
        </View>

        {/* 30 Numbered Clauses */}
        <View style={styles.sectionsContainer}>
          {sections.map((sec, idx) => (
            <View key={idx} style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>{sec.title}</Text>
              <Text style={styles.sectionBody}>{sec.body}</Text>
            </View>
          ))}
        </View>

        {/* Contact and Ownership Footer Note */}
        <View style={styles.footerCard}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#15803D" />
          <Text style={styles.footerNote}>{closing}</Text>
          <View style={styles.footerContactRow}>
            <Pressable onPress={handleContactEmail} style={styles.contactBtn}>
              <Ionicons name="mail-outline" size={16} color="#2563EB" />
              <Text style={styles.contactBtnText}>support@kobrokr.com</Text>
            </Pressable>
            <Pressable onPress={handleOpenWeb} style={styles.contactBtn}>
              <Ionicons name="globe-outline" size={16} color="#2563EB" />
              <Text style={styles.contactBtnText}>www.kobrokr.com</Text>
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  webButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },
  docHeader: {
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  badge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#1D4ED8',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  versionBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  versionBadgeText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 10,
    color: '#4B5563',
  },
  docTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 26,
    color: '#111827',
    fontWeight: '700',
    marginBottom: 6,
  },
  docSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  preambleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  preambleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  preambleHeading: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '600',
  },
  preambleText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#374151',
    lineHeight: 21,
  },
  sectionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionBlock: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 22,
  },
  sectionBody: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#374151',
    lineHeight: 21,
  },
  footerCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 20,
    alignItems: 'center',
    gap: 10,
  },
  footerNote: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#166534',
    textAlign: 'center',
    lineHeight: 18,
  },
  footerContactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 6,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  contactBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#2563EB',
  },
});
