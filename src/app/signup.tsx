import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { otpService } from '../lib/api';
import { setSession } from '../lib/auth';
import { storage } from '../lib/storage';
import { Fonts } from '../constants/theme';
import OtpInput from '../components/OtpInput';

export default function SignupScreen() {

  const { role: initialRole, ref: referralParam, referral, referral_code, redirect } = useLocalSearchParams<{
    role?: string;
    ref?: string;
    referral?: string;
    referral_code?: string;
    redirect?: string;
  }>();
  const [roleTab, setRoleTab] = useState(initialRole === 'broker' ? 'broker' : 'tenant');
  const [signupMethod, setSignupMethod] = useState<'phone' | 'email'>('phone');
  
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

  // OTP verification state
  const [signupStep, setSignupStep] = useState<'form' | 'otp'>('form');
  const [signupOtp, setSignupOtp] = useState(['', '', '', '', '', '']);



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

  // Clean mobile number (strip +91, spaces, dashes)
  const cleanMobile = mobile.replace(/[\s\-\+]/g, '').replace(/^91/, '');
  const phoneValid = /^[6-9]\d{9}$/.test(cleanMobile);
  const otpFull = signupOtp.every(d => d !== '');

  const passOk = password.length >= 8;

  // Phone signup readiness
  const phoneFormReady = Boolean(
    name.trim() &&
    phoneValid &&
    city.trim() &&
    (roleTab !== 'broker' || areasServed.trim())
  );

  // Email signup readiness
  const emailFormReady = Boolean(
    name.trim() &&
    email.trim() &&
    email.includes('@') &&
    passOk &&
    password === confirmPassword &&
    city.trim() &&
    (roleTab !== 'broker' || areasServed.trim())
  );

  const navigateAfterSignup = (user: any) => {
    const hasIdentifier = Boolean(user?.mobile || user?.email);
    const hasCity = Boolean(user?.city);
    const brokerReady = user?.role !== 'broker' || (user?.areas_served && user?.areas_served.length > 0);

    if (!hasIdentifier || !hasCity || !brokerReady) {
      router.replace('/(app)/onboarding');
      return;
    }
    if (redirect) {
      router.replace(redirect as any);
      return;
    }
    if (user?.role === 'tenant') {
      router.replace('/(tenant)/dashboard');
    } else {
      router.replace('/(broker)/dashboard');
    }
  };

  // Step 1: Validate phone form and dispatch real SMS OTP
  const handleSendPhoneOtp = async () => {
    Keyboard.dismiss();

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!phoneValid) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!city.trim()) {
      setError('Please enter your city.');
      return;
    }
    if (roleTab === 'broker' && !areasServed.trim()) {
      setError('Please provide the areas you serve.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await otpService.sendSignup(cleanMobile);
      setSignupStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and create phone-only account (email left unset in DB)
  const handleVerifyAndCreate = async () => {
    Keyboard.dismiss();
    setLoading(true);
    setError('');
    try {
      const cleanRef = referralCode.trim().toUpperCase();
      const payload: any = {
        phone: cleanMobile,
        otp: signupOtp.join(''),
        full_name: name.trim(),
        mobile: cleanMobile,
        city: city.trim(),
        role: roleTab,
      };

      if (cleanRef) {
        payload.referral_code = cleanRef;
        await storage.set('applied_referral_code', cleanRef);
      }

      if (roleTab === 'broker') {
        if (agencyName.trim()) payload.agency_name = agencyName.trim();
        payload.areas_served = areasServed.split(',').map(a => a.trim()).filter(Boolean);
      }

      const { data } = await otpService.signup(payload);

      if (data.access_token) {
        await setSession(data.access_token, data.refresh_token, data.user);
        navigateAfterSignup(data.user);
      } else {
        router.replace({
          pathname: '/login',
          params: { role: roleTab, ...(redirect ? { redirect } : {}) }
        });
      }
    } catch (err: any) {
      const payload = err.response?.data || {};
      setError(payload.detail || payload.error || 'Signup failed. Please try again.');
      setSignupOtp(['', '', '', '', '', '']);
    } finally {
      setLoading(false);
    }
  };

  // Email signup handler (mobile left unset in DB)
  const handleEmailSignup = async () => {
    Keyboard.dismiss();

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!passOk) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!city.trim()) {
      setError('Please enter your city.');
      return;
    }
    if (roleTab === 'broker' && !areasServed.trim()) {
      setError('Please provide the areas you serve.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const cleanRef = referralCode.trim().toUpperCase();
      const payload: any = {
        full_name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        city: city.trim(),
        role: roleTab,
      };

      if (cleanRef) {
        payload.referral_code = cleanRef;
        await storage.set('applied_referral_code', cleanRef);
      }

      if (roleTab === 'broker') {
        if (agencyName.trim()) payload.agency_name = agencyName.trim();
        payload.areas_served = areasServed.split(',').map(a => a.trim()).filter(Boolean);
      }

      await api.post('/auth/register', payload);

      router.replace({
        pathname: '/login',
        params: { role: roleTab, email: email.trim().toLowerCase(), confirm: '1', ...(redirect ? { redirect } : {}) }
      });
    } catch (err: any) {
      const payload = err.response?.data || {};
      setError(payload.error || payload.detail || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = styles.input;

  // ── OTP verification step ──
  if (signupStep === 'otp') {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.logo}>kobrokr</Text>
            </View>

            <Pressable onPress={() => { setSignupStep('form'); setError(''); setSignupOtp(['', '', '', '', '', '']); }} style={styles.backButton}>
              <Ionicons name="arrow-back" size={18} color="#6B7280" />
              <Text style={styles.backText}>Back</Text>
            </Pressable>

            <Text style={styles.title}>Verify your phone</Text>
            <Text style={styles.subtitle}>Enter the 6-digit OTP sent to +91 {cleanMobile}</Text>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={{ gap: 16, marginTop: 8 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>OTP</Text>
                <OtpInput value={signupOtp} onChange={setSignupOtp} />
              </View>

              <Pressable onPress={() => { setSignupOtp(['', '', '', '', '', '']); handleSendPhoneOtp(); }}>
                <Text style={styles.resendText}>
                  Didn't receive the code?{' '}
                  <Text style={styles.resendLink}>Resend</Text>
                </Text>
              </Pressable>

              <Pressable
                style={[styles.button, (!otpFull || loading) && styles.buttonDisabled]}
                onPress={handleVerifyAndCreate}
                disabled={!otpFull || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify & Create Account</Text>
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

  // ── Main signup form ──
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

          {/* Signup Method Toggle: Phone vs Email */}
          <View style={styles.methodToggle}>
            <Pressable
              style={[styles.methodButton, signupMethod === 'phone' && styles.methodButtonActive]}
              onPress={() => { setSignupMethod('phone'); setError(''); }}
            >
              <Ionicons name="phone-portrait-outline" size={16} color={signupMethod === 'phone' ? '#2563EB' : '#6B7280'} />
              <Text style={[styles.methodText, signupMethod === 'phone' && styles.methodTextActive]}>Phone (SMS OTP)</Text>
            </Pressable>
            <Pressable
              style={[styles.methodButton, signupMethod === 'email' && styles.methodButtonActive]}
              onPress={() => { setSignupMethod('email'); setError(''); }}
            >
              <Ionicons name="mail-outline" size={16} color={signupMethod === 'email' ? '#2563EB' : '#6B7280'} />
              <Text style={[styles.methodText, signupMethod === 'email' && styles.methodTextActive]}>Email & Password</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput 
                style={inputClass}
                value={name}
                onChangeText={setName}
                placeholder="Jane Doe"
              />
            </View>

            {/* ═══ PHONE METHOD FIELDS ═══ */}
            {signupMethod === 'phone' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mobile Number *</Text>
                <View style={styles.phoneRow}>
                  <View style={styles.phonePrefix}>
                    <Text style={styles.phonePrefixText}>+91</Text>
                  </View>
                  <TextInput 
                    style={[inputClass, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 }]}
                    value={mobile}
                    onChangeText={t => setMobile(t.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    keyboardType="phone-pad"
                  />
                </View>
                {mobile.length > 0 && !phoneValid && (
                  <Text style={styles.helperTextError}>Enter a valid 10-digit mobile number</Text>
                )}
              </View>
            )}

            {/* ═══ EMAIL METHOD FIELDS ═══ */}
            {signupMethod === 'email' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email *</Text>
                  <TextInput 
                    style={inputClass}
                    value={email}
                    onChangeText={setEmail}
                    placeholder={roleTab === 'broker' ? 'broker@example.com' : 'tenant@example.com'}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password *</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, backgroundColor: '#F8FAFC' }}>
                    <TextInput 
                      style={[inputClass, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Min. 8 characters"
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
                      style={[inputClass, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Repeat password"
                      secureTextEntry={!showConfirmPassword}
                    />
                    <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 12 }}>
                      <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#64748B" />
                    </Pressable>
                  </View>
                </View>
              </>
            )}

            {/* City */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>City *</Text>
              <TextInput 
                style={inputClass}
                value={city}
                onChangeText={setCity}
                placeholder="Mumbai"
              />
            </View>

            {/* Broker-specific fields */}
            {roleTab === 'broker' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Agency Name (Optional)</Text>
                  <TextInput 
                    style={inputClass}
                    value={agencyName}
                    onChangeText={setAgencyName}
                    placeholder="ABC Realty"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Areas Served (Comma-separated) *</Text>
                  <TextInput 
                    style={inputClass}
                    value={areasServed}
                    onChangeText={setAreasServed}
                    placeholder="Andheri, Powai"
                  />
                </View>
              </>
            )}

            {/* Referral Code */}
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
                style={[inputClass, isAutoFilled && styles.inputHighlight]}
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
                  : 'Enter a friend or broker\'s code to connect accounts & unlock partner benefits.'}
              </Text>
            </View>

            {/* Submit Button for Phone Signup */}
            {signupMethod === 'phone' && (
              <Pressable 
                style={[styles.button, (!phoneFormReady || loading) && styles.buttonDisabled]} 
                onPress={handleSendPhoneOtp}
                disabled={!phoneFormReady || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.buttonText}>Verify Phone & Sign up</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </View>
                )}
              </Pressable>
            )}

            {/* Submit Button for Email Signup */}
            {signupMethod === 'email' && (
              <Pressable 
                style={[styles.button, (!emailFormReady || loading) && styles.buttonDisabled]} 
                onPress={handleEmailSignup}
                disabled={!emailFormReady || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.buttonText}>Create Account</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </View>
                )}
              </Pressable>
            )}


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
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F6',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  methodButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  methodText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#6B7280',
  },
  methodTextActive: {
    fontFamily: Fonts.sansSemiBold,
    color: '#2563EB',
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
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  phonePrefix: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  phonePrefixText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
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
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  backText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#6B7280',
  },
  resendText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  resendLink: {
    fontFamily: Fonts.sansSemiBold,
    color: '#2563EB',
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
  },
  helperTextError: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#DC2626',
    marginTop: 2,
  },

});
