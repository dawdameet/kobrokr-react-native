/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  web: {
    display: "'Space Grotesk', 'IBM Plex Sans', system-ui, sans-serif",
    displayMedium: "'Space Grotesk', 'IBM Plex Sans', system-ui, sans-serif",
    displaySemiBold: "'Space Grotesk', 'IBM Plex Sans', system-ui, sans-serif",
    sans: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
    sansMedium: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
    sansSemiBold: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
    sansBold: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    monoMedium: "'IBM Plex Mono', ui-monospace, monospace",
    monoSemiBold: "'IBM Plex Mono', ui-monospace, monospace",
  },
  default: {
    display: 'SpaceGrotesk-Bold',
    displayMedium: 'SpaceGrotesk-Medium',
    displaySemiBold: 'SpaceGrotesk-SemiBold',
    sans: 'IBMPlexSans-Regular',
    sansMedium: 'IBMPlexSans-Medium',
    sansSemiBold: 'IBMPlexSans-SemiBold',
    sansBold: 'IBMPlexSans-Bold',
    serif: 'serif',
    rounded: 'normal',
    mono: 'IBMPlexMono-Regular',
    monoMedium: 'IBMPlexMono-Medium',
    monoSemiBold: 'IBMPlexMono-SemiBold',
  },
}) as {
  display: string;
  displayMedium: string;
  displaySemiBold: string;
  sans: string;
  sansMedium: string;
  sansSemiBold: string;
  sansBold: string;
  serif: string;
  rounded: string;
  mono: string;
  monoMedium: string;
  monoSemiBold: string;
};


export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
