import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clearSession } from '../../lib/auth';
import { router } from 'expo-router';
import { Fonts } from '../../constants/theme';

export default function OnboardingScreen() {
  const handleLogout = async () => {
    await clearSession();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Onboarding</Text>
        <Text style={styles.subtitle}>Please complete your profile to continue.</Text>

        <Pressable style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  }
});
