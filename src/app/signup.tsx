import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api, { otpService, emailOtpService } from '../lib/api';
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

  // ── Two-Phase Workflow State ──
  // Step 1: 'verify' (user chooses phone or email and verifies with 6-digit OTP)
  // Step 2: 'details' (pre-fills the verified credential, asks for remaining details)
  const [currentStep, setCurrentStep] = useState<'verify' | 'details'>('verify');

  // Step 1 Verification method & sub-step
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [verifySubStep, setVerifySubStep] = useState<'input' | 'otp'>('input');

  // Step 1 inputs
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  // Verified credentials stored after successful verification
  const [verifiedIdentifier, setVerifiedIdentifier] = useState<{
    type: 'phone' | 'email';
    value: string;
    otp: string;
  } | null>(null);

  // Step 2 Details Form State
  const [roleTab, setRoleTab] = useState<'tenant' | 'broker'>(initialRole === 'broker' ? 'broker' : 'tenant');
  const [fullName, setFullName] = useState('');
  // When phone was verified in Step 1, user enters email in Step 2:
  const [detailEmail, setDetailEmail] = useState('');
  // When email was verified in Step 1, user enters mobile in Step 2:
  const [detailMobile, setDetailMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [city, setCity] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [areasServed, setAreasServed] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Persist deep link referral code silently in storage without rendering in signup form
  useEffect(() => {
    async function persistReferralParam() {
      const directCode = referralParam || referral || referral_code;
      if (directCode) {
        const clean = String(directCode).trim().toUpperCase();
        await storage.set('applied_referral_code', clean);
      }
    }
    persistReferralParam();
  }, [referralParam, referral, referral_code]);

  // Clean strings
  const cleanPhoneInput = phoneInput.replace(/[\s\-\+]/g, '').replace(/^91/, '');
  const cleanDetailMobile = detailMobile.replace(/[\s\-\+]/g, '').replace(/^91/, '');
  const isPhoneInputValid = /^[6-9]\d{9}$/.test(cleanPhoneInput);
  const isDetailMobileValid = /^[6-9]\d{9}$/.test(cleanDetailMobile);
  const isEmailInputValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim());
  const isDetailEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(detailEmail.trim());
  const isOtpFull = otp.every(d => d !== '');

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

  // ── Step 1 Handlers: Phone ──

  const handleSendPhoneOtp = async () => {
    Keyboard.dismiss();
    if (!isPhoneInputValid) {
      setError('Please enter a valid 10-digit Indian mobile number (starts with 6-9).');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await otpService.sendSignup(cleanPhoneInput);
      setVerifySubStep('otp');
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to send OTP.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    Keyboard.dismiss();
    if (!isOtpFull) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setError('');
    setLoading(true);
    const enteredOtp = otp.join('');
    try {
      await otpService.verify(cleanPhoneInput, enteredOtp, 'signup');
      setVerifiedIdentifier({
        type: 'phone',
        value: cleanPhoneInput,
        otp: enteredOtp,
      });
      setCurrentStep('details');
      setError('');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Invalid or expired OTP. Please try again.';
      setError(msg);
      setOtp(['', '', '', '', '', '']);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1 Handlers: Email ──

  const handleSendEmailOtp = async () => {
    Keyboard.dismiss();
    if (!isEmailInputValid) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await emailOtpService.sendSignup(emailInput.trim().toLowerCase());
      setVerifySubStep('otp');
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to send email code.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    Keyboard.dismiss();
    if (!isOtpFull) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setError('');
    setLoading(true);
    const enteredOtp = otp.join('');
    try {
      await emailOtpService.verify(emailInput.trim().toLowerCase(), enteredOtp, 'signup');
      setVerifiedIdentifier({
        type: 'email',
        value: emailInput.trim().toLowerCase(),
        otp: enteredOtp,
      });
      setCurrentStep('details');
      setError('');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Invalid or expired verification code.';
      setError(msg);
      setOtp(['', '', '', '', '', '']);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 Handler: Complete Registration ──

  const handleCompleteRegistration = async () => {
    Keyboard.dismiss();

    if (!fullName.trim()) {
      setError('Please enter your full name.');
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
      const savedRef = await storage.get('applied_referral_code');
      const cleanRef = savedRef ? savedRef.trim().toUpperCase() : undefined;

      if (verifiedIdentifier?.type === 'phone') {
        // Required email field as requested
        if (!detailEmail.trim() || !detailEmail.includes('@')) {
          setError('Please provide a valid email address.');
          setLoading(false);
          return;
        }

        const payload: any = {
          phone: verifiedIdentifier.value,
          otp: verifiedIdentifier.otp,
          full_name: fullName.trim(),
          mobile: verifiedIdentifier.value,
          email: detailEmail.trim().toLowerCase(),
          city: city.trim(),
          role: roleTab,
        };

        if (password) {
          if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            setLoading(false);
            return;
          }
          payload.password = password;
        }

        if (cleanRef) {
          payload.referral_code = cleanRef;
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
            params: { role: roleTab, ...(redirect ? { redirect } : {}) },
          });
        }
      } else if (verifiedIdentifier?.type === 'email') {
        // Email was verified in Step 1. Mobile is required as remaining field.
        if (!isDetailMobileValid) {
          setError('Please enter a valid 10-digit Indian mobile number.');
          setLoading(false);
          return;
        }

        if (!password || password.length < 8) {
          setError('Password must be at least 8 characters long.');
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }

        const payload: any = {
          full_name: fullName.trim(),
          email: verifiedIdentifier.value,
          mobile: cleanDetailMobile,
          password,
          city: city.trim(),
          role: roleTab,
          email_verified: true,
        };

        if (cleanRef) {
          payload.referral_code = cleanRef;
        }

        if (roleTab === 'broker') {
          if (agencyName.trim()) payload.agency_name = agencyName.trim();
          payload.areas_served = areasServed.split(',').map(a => a.trim()).filter(Boolean);
        }

        const { data } = await api.post('/auth/register', payload);

        if (data.access_token) {
          await setSession(data.access_token, data.refresh_token, data.user);
          navigateAfterSignup(data.user);
        } else {
          router.replace({
            pathname: '/login',
            params: { role: roleTab, email: verifiedIdentifier.value, confirm: '1', ...(redirect ? { redirect } : {}) },
          });
        }
      }
    } catch (err: any) {
      const payload = err.response?.data || {};
      setError(payload.detail || payload.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reset to Step 1
  const handleBackToVerification = () => {
    setCurrentStep('verify');
    setVerifySubStep('input');
    setOtp(['', '', '', '', '', '']);
    setError('');
  };

  const inputClass = styles.input;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: PHASE 1 — VERIFICATION FIRST
  // ═══════════════════════════════════════════════════════════════════════════
  if (currentStep === 'verify') {
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
            {/* Logo */}
            <View style={styles.header}>
              <Text style={styles.logo}>kobrokr</Text>
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              {verifySubStep === 'input'
                ? "First, verify your phone or email to get started."
                : method === 'phone'
                ? `Enter the 6-digit SMS code sent to +91 ${cleanPhoneInput}`
                : `Enter the 6-digit code sent to ${emailInput.trim()}`}
            </Text>

            {/* Error banner */}
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Verification Method Toggle (Visible on input sub-step) */}
            {verifySubStep === 'input' && (
              <View style={styles.methodToggle}>
                <Pressable
                  style={[styles.methodButton, method === 'phone' && styles.methodButtonActive]}
                  onPress={() => {
                    setMethod('phone');
                    setError('');
                  }}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={16}
                    color={method === 'phone' ? '#2563EB' : '#6B7280'}
                  />
                  <Text style={[styles.methodText, method === 'phone' && styles.methodTextActive]}>
                    Phone Verification
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.methodButton, method === 'email' && styles.methodButtonActive]}
                  onPress={() => {
                    setMethod('email');
                    setError('');
                  }}
                >
                  <Ionicons
                    name="mail-outline"
                    size={16}
                    color={method === 'email' ? '#2563EB' : '#6B7280'}
                  />
                  <Text style={[styles.methodText, method === 'email' && styles.methodTextActive]}>
                    Email Verification
                  </Text>
                </Pressable>
              </View>
            )}

            {/* ── Sub-step: INPUT ── */}
            {verifySubStep === 'input' && (
              <View style={styles.form}>
                {method === 'phone' ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Mobile Number *</Text>
                    <View style={styles.phoneRow}>
                      <View style={styles.phonePrefix}>
                        <Text style={styles.phonePrefixText}>+91</Text>
                      </View>
                      <TextInput
                        style={[inputClass, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                        value={phoneInput}
                        onChangeText={(text) => {
                          setPhoneInput(text);
                          if (error) setError('');
                        }}
                        placeholder="10-digit mobile number"
                        keyboardType="phone-pad"
                        maxLength={10}
                        autoFocus
                      />
                    </View>
                    <Text style={styles.helperText}>
                      We'll send a 6-digit OTP code to verify this number.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email Address *</Text>
                    <TextInput
                      style={inputClass}
                      value={emailInput}
                      onChangeText={(text) => {
                        setEmailInput(text);
                        if (error) setError('');
                      }}
                      placeholder="e.g. yourname@domain.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                    <Text style={styles.helperText}>
                      We'll send a 6-digit verification code to this email.
                    </Text>
                  </View>
                )}

                {/* Send Code Button */}
                <Pressable
                  style={[
                    styles.button,
                    ((method === 'phone' && !isPhoneInputValid) ||
                      (method === 'email' && !isEmailInputValid) ||
                      loading) &&
                      styles.buttonDisabled,
                  ]}
                  onPress={method === 'phone' ? handleSendPhoneOtp : handleSendEmailOtp}
                  disabled={
                    (method === 'phone' && !isPhoneInputValid) ||
                    (method === 'email' && !isEmailInputValid) ||
                    loading
                  }
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.buttonText}>Send Verification Code</Text>
                      <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </View>
                  )}
                </Pressable>
              </View>
            )}

            {/* ── Sub-step: OTP VERIFY ── */}
            {verifySubStep === 'otp' && (
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Enter 6-Digit Code</Text>
                  <OtpInput value={otp} onChange={setOtp} />
                </View>

                {/* Change target or Resend row */}
                <View style={styles.otpHelperRow}>
                  <Pressable
                    onPress={() => {
                      setVerifySubStep('input');
                      setOtp(['', '', '', '', '', '']);
                      setError('');
                    }}
                  >
                    <Text style={styles.changeTargetLink}>
                      Change {method === 'phone' ? 'number' : 'email'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setOtp(['', '', '', '', '', '']);
                      if (method === 'phone') handleSendPhoneOtp();
                      else handleSendEmailOtp();
                    }}
                    disabled={loading}
                  >
                    <Text style={styles.resendLink}>Resend code</Text>
                  </Pressable>
                </View>

                {/* Verify & Continue Button */}
                <Pressable
                  style={[styles.button, (!isOtpFull || loading) && styles.buttonDisabled]}
                  onPress={method === 'phone' ? handleVerifyPhoneOtp : handleVerifyEmailOtp}
                  disabled={!isOtpFull || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.buttonText}>Verify & Continue</Text>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    </View>
                  )}
                </Pressable>
              </View>
            )}

            {/* Footer link to login */}
            <Pressable
              onPress={() =>
                router.push(
                  `/login?role=${roleTab}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}` as any
                )
              }
              style={styles.footerLink}
            >
              <Text style={styles.footerText}>
                Already have an account? <Text style={styles.linkText}>Log in</Text>
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: PHASE 2 — COMPLETE REMAINING DETAILS
  // ═══════════════════════════════════════════════════════════════════════════
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
          {/* Back to verification button */}
          <Pressable onPress={handleBackToVerification} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color="#6B7280" />
            <Text style={styles.backText}>Change verified {verifiedIdentifier?.type}</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.logo}>kobrokr</Text>
          </View>

          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.subtitle}>
            Enter your details to finish setting up your account.
          </Text>

          {/* Error banner */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Verified credential badge card */}
          <View style={styles.verifiedCard}>
            <View style={styles.verifiedCardLeft}>
              <View style={styles.verifiedIconCircle}>
                <Ionicons
                  name={verifiedIdentifier?.type === 'phone' ? 'call' : 'mail'}
                  size={16}
                  color="#15803D"
                />
              </View>
              <View>
                <Text style={styles.verifiedCardLabel}>
                  {verifiedIdentifier?.type === 'phone' ? 'VERIFIED MOBILE' : 'VERIFIED EMAIL'}
                </Text>
                <Text style={styles.verifiedCardValue}>
                  {verifiedIdentifier?.type === 'phone'
                    ? `+91 ${verifiedIdentifier.value}`
                    : verifiedIdentifier?.value}
                </Text>
              </View>
            </View>
            <View style={styles.verifiedBadgePill}>
              <Ionicons name="checkmark-circle" size={14} color="#15803D" />
              <Text style={styles.verifiedBadgeText}>Verified</Text>
            </View>
          </View>

          {/* Role Toggle: Tenant vs Broker */}
          <View style={styles.roleToggle}>
            <Pressable
              style={[styles.roleButton, roleTab === 'tenant' && styles.roleButtonActive]}
              onPress={() => setRoleTab('tenant')}
            >
              <Text style={[styles.roleText, roleTab === 'tenant' && styles.roleTextActive]}>
                I'm a Tenant
              </Text>
            </Pressable>
            <Pressable
              style={[styles.roleButton, roleTab === 'broker' && styles.roleButtonActive]}
              onPress={() => setRoleTab('broker')}
            >
              <Text style={[styles.roleText, roleTab === 'broker' && styles.roleTextActive]}>
                I'm a Broker
              </Text>
            </Pressable>
          </View>

          {/* Details Form */}
          <View style={styles.form}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={inputClass}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Rahul Sharma"
                autoCapitalize="words"
              />
            </View>

            {/* If verified by PHONE: ask for EMAIL */}
            {verifiedIdentifier?.type === 'phone' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address *</Text>
                <TextInput
                  style={inputClass}
                  value={detailEmail}
                  onChangeText={setDetailEmail}
                  placeholder="e.g. rahul@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.helperText}>
                  Your account notifications will be sent here.
                </Text>
              </View>
            )}

            {/* If verified by EMAIL: ask for MOBILE */}
            {verifiedIdentifier?.type === 'email' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mobile Number *</Text>
                <View style={styles.phoneRow}>
                  <View style={styles.phonePrefix}>
                    <Text style={styles.phonePrefixText}>+91</Text>
                  </View>
                  <TextInput
                    style={[inputClass, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                    value={detailMobile}
                    onChangeText={setDetailMobile}
                    placeholder="10-digit mobile number"
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
                <Text style={styles.helperText}>
                  Brokers and prospective clients will reach you at this number.
                </Text>
              </View>
            )}

            {/* Password */}
            {verifiedIdentifier?.type === 'email' ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Create Password *</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[inputClass, { flex: 1, borderWidth: 0 }]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Min. 8 characters"
                      secureTextEntry={!showPassword}
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      style={{ paddingHorizontal: 12 }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#6B7280"
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password *</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[inputClass, { flex: 1, borderWidth: 0 }]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Re-enter password"
                      secureTextEntry={!showConfirmPassword}
                    />
                    <Pressable
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ paddingHorizontal: 12 }}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#6B7280"
                      />
                    </Pressable>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Create Password (Optional)</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[inputClass, { flex: 1, borderWidth: 0 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Optional: for password login"
                    secureTextEntry={!showPassword}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={{ paddingHorizontal: 12 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#6B7280"
                    />
                  </Pressable>
                </View>
                <Text style={styles.helperText}>
                  You can always log in passwordless with SMS OTP.
                </Text>
              </View>
            )}

            {/* City */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>City *</Text>
              <TextInput
                style={inputClass}
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Mumbai"
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
                    placeholder="e.g. Sharma Properties"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Areas Served *</Text>
                  <TextInput
                    style={inputClass}
                    value={areasServed}
                    onChangeText={setAreasServed}
                    placeholder="e.g. Andheri West, Bandra, Juhu"
                  />
                  <Text style={styles.helperText}>Separate multiple areas with commas.</Text>
                </View>
              </>
            )}

            {/* Submit Button */}
            <Pressable
              style={[
                styles.button,
                (!fullName.trim() ||
                  !city.trim() ||
                  (roleTab === 'broker' && !areasServed.trim()) ||
                  (verifiedIdentifier?.type === 'phone' && !isDetailEmailValid) ||
                  (verifiedIdentifier?.type === 'email' &&
                    (!isDetailMobileValid || !password || password.length < 8 || password !== confirmPassword)) ||
                  loading) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleCompleteRegistration}
              disabled={
                !fullName.trim() ||
                !city.trim() ||
                (roleTab === 'broker' && !areasServed.trim()) ||
                (verifiedIdentifier?.type === 'phone' && !isDetailEmailValid) ||
                (verifiedIdentifier?.type === 'email' &&
                  (!isDetailMobileValid || !password || password.length < 8 || password !== confirmPassword)) ||
                loading
              }
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.buttonText}>Complete Registration</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </View>
              )}
            </Pressable>
          </View>

          {/* Footer link to login */}
          <Pressable
            onPress={() =>
              router.push(
                `/login?role=${roleTab}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}` as any
              )
            }
            style={styles.footerLink}
          >
            <Text style={styles.footerText}>
              Already have an account? <Text style={styles.linkText}>Log in</Text>
            </Text>
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
    marginBottom: 24,
  },
  logo: {
    fontFamily: Fonts.display,
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#6B7280',
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
    marginBottom: 20,
    lineHeight: 20,
  },
  methodToggle: {
    flexDirection: 'column',
    backgroundColor: '#EEF2F6',
    borderRadius: 12,
    padding: 4,
    gap: 6,
    marginBottom: 20,
  },
  methodButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
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
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    fontSize: 13,
    flex: 1,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
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
  helperText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  otpHelperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  changeTargetLink: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#6B7280',
  },
  resendLink: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#2563EB',
  },
  verifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  verifiedCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  verifiedIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedCardLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#15803D',
    letterSpacing: 0.5,
  },
  verifiedCardValue: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: '#111827',
  },
  verifiedBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  verifiedBadgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: '#15803D',
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
});
