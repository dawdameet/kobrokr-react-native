import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import api from '../lib/api';
import { setSession } from '../lib/auth';
import { Fonts } from '../constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { role: initialRole } = useLocalSearchParams();
  const [roleTab, setRoleTab] = useState(initialRole === 'broker' ? 'broker' : 'tenant');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleSuccess(id_token);
    } else if (response?.type === 'error') {
      setGoogleLoading(false);
      setError(response.error?.message || 'Google Login failed');
    }
  }, [response]);

  const handleGoogleSuccess = async (idToken: string) => {
    if (!idToken) {
      setGoogleLoading(false);
      setError('No ID token found');
      return;
    }

    try {
      const { data } = await api.post('/auth/google', {
        credential: idToken,
        role: roleTab,
      });

      await setSession(data.access_token, data.refresh_token, data.user);
      
      if (!data.user?.mobile || !data.user?.city || (data.user?.role === 'broker' && (!data.user?.areas_served?.length))) {
        router.replace('/(app)/onboarding');
        return;
      }

      if (data.user?.role === 'tenant') {
        router.replace('/(tenant)/dashboard');
      } else {
        router.replace('/(broker)/dashboard');
      }

    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Google Login failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setError('');
    setLoading(true);
    
    try {
      const { data } = await api.post('/auth/login', {
        email,
        password,
        role: roleTab,
      });

      await setSession(data.access_token, data.refresh_token, data.user);
      
      if (!data.user?.mobile || !data.user?.city || (data.user?.role === 'broker' && (!data.user?.areas_served?.length))) {
        router.replace('/(app)/onboarding');
        return;
      }

      if (data.user?.role === 'tenant') {
        router.replace('/(tenant)/dashboard');
      } else {
        router.replace('/(broker)/dashboard');
      }

    } catch (err: any) {
      const payload = err.response?.data || {};
      setError(payload.error || payload.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const initiateGoogleLogin = () => {
    Keyboard.dismiss();
    setError('');
    setGoogleLoading(true);
    promptAsync();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.logo}>kobrokr</Text>
            </View>

            <View style={styles.roleToggle}>
              <Pressable 
                style={[styles.roleButton, roleTab === 'tenant' && styles.roleButtonActive]}
                onPress={() => setRoleTab('tenant')}
              >
                <Text style={[styles.roleText, roleTab === 'tenant' && styles.roleTextActive]}>Tenant</Text>
              </Pressable>
              <Pressable 
                style={[styles.roleButton, roleTab === 'broker' && styles.roleButtonActive]}
                onPress={() => setRoleTab('broker')}
              >
                <Text style={[styles.roleText, roleTab === 'broker' && styles.roleTextActive]}>Broker</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>
              {roleTab === 'broker' ? 'Login as Broker' : 'Login as Tenant'}
            </Text>
            <Text style={styles.subtitle}>Sign in to your kobrokr account</Text>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable 
              style={[styles.googleButton, googleLoading && styles.buttonDisabled]} 
              onPress={initiateGoogleLogin}
              disabled={googleLoading || loading || !request}
            >
              {googleLoading ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              )}
            </Pressable>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or continue with email</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput 
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={roleTab === 'broker' ? 'broker@example.com' : 'tenant@example.com'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput 
                    style={[styles.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 10 }}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#64748B" />
                  </Pressable>
                </View>
              </View>

              <Pressable 
                style={[styles.button, loading && styles.buttonDisabled]} 
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Sign in</Text>
                )}
              </Pressable>
            </View>

            <Pressable onPress={() => router.push(`/signup?role=${roleTab}`)} style={styles.footerLink}>
              <Text style={styles.footerText}>No account? <Text style={styles.linkText}>Sign up</Text></Text>
            </Pressable>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontFamily: Fonts.display,
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  roleButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  roleTextActive: {
    fontFamily: Fonts.sansSemiBold,
    color: '#111827',
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  googleButtonText: {
    fontFamily: Fonts.sansMedium,
    color: '#374151',
    fontSize: 15,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontFamily: Fonts.sans,
    paddingHorizontal: 12,
    color: '#6B7280',
    fontSize: 12,
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: Fonts.sans,
    color: '#B91C1C',
    fontSize: 14,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  input: {
    fontFamily: Fonts.sans,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footerLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#6B7280',
  },
  linkText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#2563EB',
    fontWeight: '500',
  }
});
