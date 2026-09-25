import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { setSession } from '../lib/auth';
import { storage } from '../lib/storage';
import { Fonts } from '../constants/theme';

export default function SignupScreen() {

  const { role: initialRole, ref: referralParam, referral, referral_code, redirect } = useLocalSearchParams<{
    role?: string;
    ref?: string;
    referral?: string;
    referral_code?: string;
    redirect?: string;
  }>();
  const [roleTab, setRoleTab] = useState(initialRole === 'broker' ? 'broker' : 'tenant');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  
  // New fields
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [areasServed, setAreasServed] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function resolveReferral() {
      const directCode = referralParam || referral || referral_code;
      if (directCode) {
        const clean = String(directCode).trim().toUpperCase();
        setReferralCode(clean);
        setIsAutoFilled(true);
        await storage.set('applied_referral_code', clean);
      } else {
        const saved = await storage.get('applied_referral_code');
        if (saved) {
          setReferralCode(saved.trim().toUpperCase());
          setIsAutoFilled(true);
        }
      }
    }
    resolveReferral();
  }, [referralParam, referral, referral_code]);



  const handleSignup = async () => {
    Keyboard.dismiss();
    
    // Basic validation
    if (!name || !email || !password || !confirmPassword || !mobile || !city) {
      setError('Please fill all required fields.');
      return;
    }
    
    if (roleTab === 'broker' && !areasServed) {
      setError('Please provide the areas you serve.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setError('');
    setLoading(true);
    
    try {
      const cleanRef = referralCode.trim().toUpperCase();
      const payload: any = {
        full_name: name,
        email,
        password,
        mobile,
        city,
        role: roleTab,
      };

      if (cleanRef) {
        payload.referral_code = cleanRef;
        await storage.set('applied_referral_code', cleanRef);
      }

      if (roleTab === 'broker') {
        payload.agency_name = agencyName;
        // Split areas by comma and trim whitespace
        payload.areas_served = areasServed.split(',').map(a => a.trim()).filter(a => a);
      }

      const { data } = await api.post('/auth/register', payload);

      // Redirect to login page after successful registration
      router.replace({
        pathname: '/login',
        params: { role: roleTab, email, confirm: '1', ...(redirect ? { redirect } : {}) }
      });

    } catch (err: any) {
      const payload = err.response?.data || {};
      setError(payload.error || payload.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
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
            {roleTab === 'broker' ? 'Sign up as Broker' : 'Sign up as Tenant'}
          </Text>
          <Text style={styles.subtitle}>Create your kobrokr account</Text>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput 
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Jane Doe"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email *</Text>
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
              <Text style={styles.label}>Mobile *</Text>
              <TextInput 
                style={styles.input}
                value={mobile}
                onChangeText={setMobile}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>City *</Text>
              <TextInput 
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Mumbai"
              />
            </View>

            {roleTab === 'broker' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Agency Name (Optional)</Text>
                  <TextInput 
                    style={styles.input}
                    value={agencyName}
                    onChangeText={setAgencyName}
                    placeholder="ABC Realty"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Areas Served (Comma-separated) *</Text>
                  <TextInput 
                    style={styles.input}
                    value={areasServed}
                    onChangeText={setAreasServed}
                    placeholder="Andheri, Powai"
                  />
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password *</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, backgroundColor: '#F8FAFC' }}>
                <TextInput 
                  style={[styles.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 12 }}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#64748B" />
                </Pressable>
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password *</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, backgroundColor: '#F8FAFC' }}>
                <TextInput 
                  style={[styles.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showConfirmPassword}
                />
                <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 12 }}>
                  <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#64748B" />
                </Pressable>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.referralLabelRow}>
                <Text style={styles.label}>Referral Code (Optional)</Text>
                {isAutoFilled && referralCode.trim().length > 0 && (
                  <View style={styles.appliedBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#15803D" />
                    <Text style={styles.appliedBadgeText}>Link Applied</Text>
                  </View>
                )}
              </View>
              <TextInput 
                style={[styles.input, isAutoFilled && styles.inputHighlight]}
                value={referralCode}
                onChangeText={(text) => {
                  setReferralCode(text.toUpperCase());
                  setIsAutoFilled(false);
                }}
                placeholder="e.g. KB-94X2A"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Text style={styles.helperText}>
                {isAutoFilled 
                  ? 'Referral code auto-detected from invite link.' 
                  : 'Enter a friend or broker’s code to connect accounts & unlock partner benefits.'}
              </Text>
            </View>

            <Pressable 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign up</Text>
              )}
            </Pressable>
          </View>

          <Pressable onPress={() => router.push(`/login?role=${roleTab}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}` as any)} style={styles.footerLink}>
            <Text style={styles.footerText}>Already have an account? <Text style={styles.linkText}>Log in</Text></Text>
          </Pressable>
        </ScrollView>
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
    flexGrow: 1,
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
  },
  referralLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  appliedBadgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: '#15803D',
  },
  inputHighlight: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  helperText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  }
});
