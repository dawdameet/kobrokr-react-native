import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storage } from '../lib/storage';

export default function LandingScreen() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const userStr = await storage.get('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.role === 'tenant') {
            router.replace('/(tenant)/dashboard');
            return;
          } else if (user.role === 'broker') {
            router.replace('/(broker)/dashboard');
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
      setChecking(false);
    }
    checkSession();
  }, []);

  if (checking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>kobrokr</Text>
        <Text style={styles.subtitle}>Streamline your property workflow.</Text>
        
        <View style={styles.actions}>
          <Pressable 
            style={styles.buttonPrimary} 
            onPress={() => router.push('/login')}
          >
            <Text style={styles.buttonPrimaryText}>Log In</Text>
          </Pressable>
          <Pressable 
            style={styles.buttonSecondary} 
            onPress={() => router.push('/signup')}
          >
            <Text style={styles.buttonSecondaryText}>Sign Up</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // gray-50
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#2563EB', // blue-600
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280', // gray-500
    marginBottom: 48,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: 16,
  },
  buttonPrimary: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#D1D5DB', // gray-300
  },
  buttonSecondaryText: {
    color: '#374151', // gray-700
    fontSize: 16,
    fontWeight: '600',
  },
});
