import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../constants/theme';
import { storage } from '../../lib/storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  image: any;
  titleTop: string;
  titleHighlight: string;
  subtitle: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'slide_1',
    image: require('../../../assets/images/onboarding_art_1.png'),
    titleTop: 'Manage Your',
    titleHighlight: 'Entire Inventory',
    subtitle: 'List your properties once and manage everything from one dashboard. Every broker in your city can see your listings.',
  },
  {
    id: 'slide_2',
    image: require('../../../assets/images/onboarding_art_2.png'),
    titleTop: 'Share Listings',
    titleHighlight: 'in One Tap',
    subtitle: 'Send a property or a curated collection to clients via link. Discover walkthrough videos from other brokers.',
  },
  {
    id: 'slide_3',
    image: require('../../../assets/images/onboarding_art_3.png'),
    titleTop: 'Leads,',
    titleHighlight: 'Straight to You',
    subtitle: 'Get enquiries from brokers and clients across your city.',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);

  const finishOnboarding = async (targetRoute: '/login' | '/signup') => {
    await storage.set('has_completed_onboarding', 'true');
    router.push(`${targetRoute}?role=broker` as any);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      finishOnboarding('/signup');
    }
  };

  const handleSkip = () => {
    finishOnboarding('/login');
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
      setCurrentIndex(index);
    }
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => {
    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        {/* Illustration Container */}
        <View style={styles.imageContainer}>
          <Image
            source={item.image}
            style={styles.illustration}
            resizeMode="contain"
          />
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            <Text style={styles.titleTop}>{item.titleTop}{'\n'}</Text>
            <Text style={styles.titleHighlight}>{item.titleHighlight}</Text>
          </Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
    );
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.brandLogo}>kobrokr</Text>
        {!isLastSlide ? (
          <Pressable onPress={handleSkip} style={styles.skipButton} hitSlop={12}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {/* Swipeable Carousel */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.carouselList}
      />

      {/* Bottom Controls */}
      <View style={styles.bottomSection}>
        {/* Pagination Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, idx) => {
            const isActive = idx === currentIndex;
            return (
              <Pressable
                key={idx}
                onPress={() => {
                  flatListRef.current?.scrollToIndex({ index: idx, animated: true });
                }}
                hitSlop={8}
                style={[
                  styles.dot,
                  isActive ? styles.dotActive : styles.dotInactive,
                ]}
              />
            );
          })}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Pressable style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>
              {isLastSlide ? 'Get Started as Broker' : 'Next'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={styles.secondaryLink}
            onPress={() => finishOnboarding('/login')}
          >
            <Text style={styles.secondaryLinkText}>
              Already have an account? <Text style={styles.secondaryLinkBold}>Log in</Text>
            </Text>
          </Pressable>
        </View>
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 6,
  },
  brandLogo: {
    fontFamily: Fonts.display,
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2563EB',
    letterSpacing: -0.5,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  skipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#64748B',
  },
  carouselList: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  imageContainer: {
    width: '100%',
    height: Math.min(SCREEN_HEIGHT * 0.42, 380),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  titleTop: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 28,
  },
  titleHighlight: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    gap: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 26,
    backgroundColor: '#2563EB',
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#CBD5E1',
  },
  actionButtons: {
    width: '100%',
    gap: 14,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  secondaryLinkText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#64748B',
  },
  secondaryLinkBold: {
    fontFamily: Fonts.sansSemiBold,
    color: '#2563EB',
    fontWeight: '600',
  },
});
