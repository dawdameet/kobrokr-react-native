import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
  Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../lib/api';
import { otpService } from '../lib/api';
import { setSession } from '../lib/auth';
import { Fonts } from '../constants/theme';
import OtpInput from '../components/OtpInput';

// ── Error message helper ─────────────────────────────────────────────────────

function getAuthErrorMessage(err: any, role: string) {
  if (!err) return 'An unexpected error occurred. Please try again.';

  if (!err.response) {
    if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
      return 'The server took too long to respond. The backend may be starting up—please try again in 15-30 seconds.';
    }
    if (err.message === 'Network Error') {
      return 'Unable to reach the server. Please check your internet connection and try again.';
    }
    return err.message || 'Unable to connect to the server. Please try again.';
  }

  const { status, data } = err.response;

  if (typeof data === 'string') {
    if (status === 502 || status === 503 || status === 504) {
      return 'The server is currently waking up or experiencing high traffic. Please wait 15-20 seconds and try again.';
    }
    if (status >= 500) {
      return 'A server error occurred (500). Please try again shortly.';
    }
    return `Server error (${status}). Please try again.`;
  }

  if (data && typeof data === 'object') {
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
    if (typeof data.detail === 'string' && data.detail.trim()) return data.detail;
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
    if (Array.isArray(data.detail)) {
      return data.detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', ');
    }
  }

  if (status === 401) {
    const otherRole = role === 'broker' ? 'Tenant' : 'Broker';
    return `Invalid credentials. If your account is registered as a ${otherRole}, please switch to the ${otherRole} tab above.`;
  }
  if (status === 403) {
    return 'Account access restricted. Please verify your email before logging in.';
  }
  if (status === 404) {
    return 'Account not found. Please double-check your details or sign up.';
  }

  return 'Login failed. Please verify your details and ensure the correct tab (Tenant or Broker) is selected.';
}

// ── Forgot Password Modal ────────────────────────────────────────────────────

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'phone' | 'email'>('phone');

  // Phone OTP reset state
  const [phone, setPhone] = useState('');
  const [resetOtp, setResetOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [resetStep, setResetStep] = useState<'phone' | 'otp' | 'password'>('phone');

  // Email reset state
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const phoneValid = /^[6-9]\d{9}$/.test(phone);
  const otpFull = resetOtp.every(d => d !== '');

  const handleSendResetOtp = async () => {
    setLoading(true); setError('');
    try {
      await otpService.resetSend(phone);
      setResetStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to send OTP.');
    } finally { setLoading(false); }
  };

  const handleVerifyResetOtp = () => {
    // Move to password step; actual OTP verification happens on confirm
    setResetStep('password');
  };

  const handleResetConfirm = async () => {
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true); setError('');
    try {
      await otpService.resetConfirm(phone, resetOtp.join(''), newPassword);
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Reset failed. OTP may have expired.');
      setResetStep('otp');
      setResetOtp(['', '', '', '', '', '']);
    } finally { setLoading(false); }
  };

  const handleEmailReset = async () => {
    if (!email) return;
    setLoading(true); setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setEmailSent(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Something went wrong.');
    } finally { setLoading(false); }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
          {/* Close button */}
          <Pressable onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={22} color="#9CA3AF" />
          </Pressable>

          {done ? (
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={28} color="#16A34A" />
              </View>
              <Text style={styles.modalTitle}>Password reset!</Text>
              <Text style={styles.modalSubtitle}>Your password has been updated. You can now log in.</Text>
              <Pressable style={styles.button} onPress={onClose}>
                <Text style={styles.buttonText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              <View>
                <Text style={styles.modalTitle}>Forgot password?</Text>
                <Text style={styles.modalSubtitle}>Reset via SMS OTP or email link.</Text>
              </View>

              {/* Mode toggle */}
              <View style={styles.modeToggle}>
                <Pressable
                  style={[styles.modeButton, mode === 'phone' && styles.modeButtonActive]}
                  onPress={() => { setMode('phone'); setError(''); }}
                >
                  <Text style={[styles.modeText, mode === 'phone' && styles.modeTextActive]}>SMS OTP</Text>
                </Pressable>
                <Pressable
                  style={[styles.modeButton, mode === 'email' && styles.modeButtonActive]}
                  onPress={() => { setMode('email'); setError(''); }}
                >
                  <Text style={[styles.modeText, mode === 'email' && styles.modeTextActive]}>Email</Text>
                </Pressable>
              </View>

              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Phone OTP flow */}
              {mode === 'phone' && (
                <>
                  {resetStep === 'phone' && (
                    <View style={{ gap: 12 }}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone Number</Text>
                        <View style={styles.phoneRow}>
                          <View style={styles.phonePrefix}>
                            <Text style={styles.phonePrefixText}>+91</Text>
                          </View>
                          <TextInput
                            style={[styles.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 }]}
                            value={phone}
                            onChangeText={t => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                            placeholder="98765 43210"
                            keyboardType="phone-pad"
                            autoFocus
                          />
                        </View>
                      </View>
                      <Pressable
                        style={[styles.button, (!phoneValid || loading) && styles.buttonDisabled]}
                        onPress={handleSendResetOtp}
                        disabled={!phoneValid || loading}
                      >
                        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>Send OTP</Text>}
                      </Pressable>
                    </View>
                  )}

                  {resetStep === 'otp' && (
                    <View style={{ gap: 12 }}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Enter OTP sent to +91 {phone}</Text>
                        <OtpInput value={resetOtp} onChange={setResetOtp} />
                      </View>
                      <Pressable onPress={handleSendResetOtp}>
                        <Text style={styles.resendText}>Didn't get it? <Text style={styles.resendLink}>Resend</Text></Text>
                      </Pressable>
                      <Pressable
                        style={[styles.button, (!otpFull || loading) && styles.buttonDisabled]}
                        onPress={handleVerifyResetOtp}
                        disabled={!otpFull || loading}
                      >
                        <Text style={styles.buttonText}>Continue</Text>
                      </Pressable>
                    </View>
                  )}

                  {resetStep === 'password' && (
                    <View style={{ gap: 12 }}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>New Password</Text>
                        <View style={styles.passwordContainer}>
                          <TextInput
                            style={[styles.input, { flex: 1, borderWidth: 0 }]}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="Min. 8 characters"
                            secureTextEntry={!showNewPass}
                            autoFocus
                          />
                          <Pressable onPress={() => setShowNewPass(v => !v)} style={{ padding: 12 }}>
                            <Ionicons name={showNewPass ? 'eye-off' : 'eye'} size={20} color="#64748B" />
                          </Pressable>
                        </View>
                      </View>
                      <Pressable
                        style={[styles.button, (newPassword.length < 8 || loading) && styles.buttonDisabled]}
                        onPress={handleResetConfirm}
                        disabled={newPassword.length < 8 || loading}
                      >
                        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>Reset Password</Text>}
                      </Pressable>
                    </View>
                  )}
                </>
              )}

              {/* Email flow */}
              {mode === 'email' && (
                <View style={{ gap: 12 }}>
                  {emailSent ? (
                    <View style={{ alignItems: 'center', gap: 12 }}>
                      <Text style={styles.modalSubtitle}>
                        If <Text style={{ fontFamily: Fonts.sansSemiBold }}>{email}</Text> is registered, a reset link has been sent.
                      </Text>
                      <Pressable style={styles.button} onPress={onClose}>
                        <Text style={styles.buttonText}>Done</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                          style={styles.input}
                          value={email}
                          onChangeText={setEmail}
                          placeholder="you@example.com"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoFocus
                        />
                      </View>
                      <Pressable
                        style={[styles.button, (!email || loading) && styles.buttonDisabled]}
                        onPress={handleEmailReset}
                        disabled={!email || loading}
                      >
                        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
                      </Pressable>
                    </>
                  )}
                </View>
              )}

              <Pressable onPress={onClose}>
                <Text style={{ textAlign: 'center', color: '#6B7280', fontSize: 14, fontFamily: Fonts.sans }}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main Login Screen ────────────────────────────────────────────────────────

export default function LoginScreen() {
  const { role: initialRole, verified, redirect, email: paramEmail, confirm } = useLocalSearchParams<{
    role?: string;
    verified?: string;
    redirect?: string;
    email?: string;
    confirm?: string;
  }>();

  const isConfirmRequired = confirm === '1';
  const [roleTab, setRoleTab] = useState(initialRole === 'broker' ? 'broker' : 'tenant');

  // Login method: 'phone' (OTP) or 'email' (password)
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');

  // Phone + OTP state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpStep, setOtpStep] = useState<'input' | 'verify'>('input');

  // Email + Password state
  const [email, setEmail] = useState(paramEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  // Unverified email state (for email login)
  const [isUnverified, setIsUnverified] = useState(isConfirmRequired);
  const [unverifiedEmail, setUnverifiedEmail] = useState(paramEmail || '');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const phoneValid = /^[6-9]\d{9}$/.test(phone);
  const otpFull = otp.every(d => d !== '');

  useEffect(() => {
    if (verified === 'true') {
      setSuccessMsg('Email verified successfully! You can now log in.');
      setError('');
      setIsUnverified(false);
    }
  }, [verified]);

  useEffect(() => {
    if (paramEmail && !email) {
      setEmail(paramEmail);
      setUnverifiedEmail(paramEmail);
      // If coming with an email param, default to email login
      setLoginMethod('email');
    }
  }, [paramEmail]);

  // ── Phone OTP handlers ──

  const handleSendOtp = async () => {
    Keyboard.dismiss();
    setLoading(true); setError('');
    try {
      await otpService.send(phone);
      setOtpStep('verify');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    Keyboard.dismiss();
    setLoading(true); setError('');
    try {
      const { data } = await otpService.login(phone, otp.join(''), roleTab);
      await setSession(data.access_token, data.refresh_token, data.user);
      navigateAfterLogin(data.user);
    } catch (err: any) {
      setError(getAuthErrorMessage(err, roleTab));
      setOtp(['', '', '', '', '', '']);
    } finally { setLoading(false); }
  };

  // ── Email + Password handlers ──

  const handlePasswordLogin = async () => {
    Keyboard.dismiss();
    setSuccessMsg('');
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
      navigateAfterLogin(data.user);
    } catch (err: any) {
      const payload = err.response?.data || {};
      if (payload.email_unverified) {
        setIsUnverified(true);
        setUnverifiedEmail(payload.email || email);
      }
      setError(getAuthErrorMessage(err, roleTab));
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation after successful login ──

  const navigateAfterLogin = (user: any) => {
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

  // ── Resend verification email ──

  const handleResend = async () => {
    const targetEmail = (unverifiedEmail || email || '').trim();
    if (!targetEmail) {
      setError('Please enter your email to resend verification.');
      return;
    }
    setResendLoading(true);
    setResendMessage('');
    try {
      await api.post('/auth/resend-verification', {
        email: targetEmail,
        role: roleTab
      });
      setResendMessage('Verification email sent! Check your inbox.');
    } catch (err: any) {
      setResendMessage(err.response?.data?.error || 'Failed to resend email.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.logo}>kobrokr</Text>
            </View>

            {/* Role toggle */}
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

            {/* Login Method Toggle: Phone vs Email */}
            <View style={styles.methodToggle}>
              <Pressable
                style={[styles.methodButton, loginMethod === 'phone' && styles.methodButtonActive]}
                onPress={() => { setLoginMethod('phone'); setError(''); }}
              >
                <Ionicons name="phone-portrait-outline" size={16} color={loginMethod === 'phone' ? '#2563EB' : '#6B7280'} />
                <Text style={[styles.methodText, loginMethod === 'phone' && styles.methodTextActive]}>Phone (OTP)</Text>
              </Pressable>
              <Pressable
                style={[styles.methodButton, loginMethod === 'email' && styles.methodButtonActive]}
                onPress={() => { setLoginMethod('email'); setError(''); }}
              >
                <Ionicons name="mail-outline" size={16} color={loginMethod === 'email' ? '#2563EB' : '#6B7280'} />
                <Text style={[styles.methodText, loginMethod === 'email' && styles.methodTextActive]}>Email & Password</Text>
              </Pressable>
            </View>

            {/* Forgot Password Modal */}
            {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}

            {/* Confirmation required banner */}
            {isConfirmRequired && (
              <View style={[styles.errorContainer, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <Ionicons name="mail" size={22} color="#2563EB" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: Fonts.sansSemiBold, color: '#1E3A8A', marginBottom: 4 }}>
                      Verify your email to continue
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: Fonts.sans, color: '#1D4ED8', lineHeight: 18, marginBottom: 10 }}>
                      Account created! We've sent a verification link to {email || paramEmail || 'your email'}. Please check your inbox and verify your email before logging in.
                    </Text>
                    <Pressable
                      style={[styles.button, { backgroundColor: '#FFFFFF', borderColor: '#93C5FD', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start' }]}
                      onPress={handleResend}
                      disabled={resendLoading}
                    >
                      {resendLoading ? (
                        <ActivityIndicator color="#2563EB" size="small" />
                      ) : (
                        <Text style={[styles.buttonText, { color: '#2563EB', fontSize: 13 }]}>Resend Verification Email</Text>
                      )}
                    </Pressable>
                    {resendMessage ? (
                      <Text style={{ marginTop: 8, fontSize: 12, color: resendMessage.includes('sent') ? '#15803D' : '#B91C1C', fontFamily: Fonts.sansMedium }}>
                        {resendMessage}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            )}

            {/* Success message */}
            {successMsg ? (
              <View style={[styles.errorContainer, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
                <Text style={[styles.errorText, { color: '#15803D' }]}>{successMsg}</Text>
              </View>
            ) : null}

            {/* Error message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                {isUnverified && loginMethod === 'email' && (
                  <View style={{ marginTop: 12 }}>
                    <Pressable
                      style={[styles.button, { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, paddingVertical: 10 }]}
                      onPress={handleResend}
                      disabled={resendLoading}
                    >
                      {resendLoading ? (
                        <ActivityIndicator color="#B91C1C" size="small" />
                      ) : (
                        <Text style={[styles.buttonText, { color: '#B91C1C', fontSize: 14 }]}>Resend Verification Email</Text>
                      )}
                    </Pressable>
                    {resendMessage ? (
                      <Text style={{ marginTop: 8, fontSize: 12, color: resendMessage.includes('sent') ? '#15803D' : '#B91C1C', fontFamily: Fonts.sansMedium, textAlign: 'center' }}>
                        {resendMessage}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            ) : null}

            {/* ═══ PHONE OTP LOGIN ═══ */}
            {loginMethod === 'phone' && (
              <View style={styles.form}>
                {otpStep === 'input' && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Phone Number</Text>
                      <View style={styles.phoneRow}>
                        <View style={styles.phonePrefix}>
                          <Text style={styles.phonePrefixText}>+91</Text>
                        </View>
                        <TextInput
                          style={[styles.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 }]}
                          value={phone}
                          onChangeText={t => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                          placeholder="98765 43210"
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>

                    {/* Switch to email */}
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>or</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    <Pressable
                      onPress={() => { setLoginMethod('email'); setError(''); }}
                      style={styles.switchButton}
                    >
                      <Text style={styles.switchButtonText}>Continue with Email</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.button, (!phoneValid || loading) && styles.buttonDisabled]}
                      onPress={handleSendOtp}
                      disabled={!phoneValid || loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.buttonText}>Send OTP</Text>
                          <Ionicons name="arrow-forward" size={16} color="#fff" />
                        </View>
                      )}
                    </Pressable>
                  </>
                )}

                {otpStep === 'verify' && (
                  <>
                    <Pressable onPress={() => { setOtpStep('input'); setError(''); setOtp(['', '', '', '', '', '']); }} style={styles.backButton}>
                      <Ionicons name="arrow-back" size={18} color="#6B7280" />
                      <Text style={styles.backText}>Back</Text>
                    </Pressable>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Enter OTP sent to +91 {phone}</Text>
                      <OtpInput value={otp} onChange={setOtp} />
                    </View>

                    <Pressable onPress={() => { setOtp(['', '', '', '', '', '']); handleSendOtp(); }}>
                      <Text style={styles.resendText}>
                        Didn't receive the code?{' '}
                        <Text style={styles.resendLink}>Resend</Text>
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.button, (!otpFull || loading) && styles.buttonDisabled]}
                      onPress={handleVerifyOtp}
                      disabled={!otpFull || loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.buttonText}>Verify & Login</Text>
                      )}
                    </Pressable>
                  </>
                )}
              </View>
            )}

            {/* ═══ EMAIL + PASSWORD LOGIN ═══ */}
            {loginMethod === 'email' && (
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
                  <View style={{ alignItems: 'flex-end', marginTop: 2 }}>
                    <Pressable onPress={() => setShowForgot(true)}>
                      <Text style={styles.forgotText}>Forgot Password?</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Switch to phone */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Pressable
                  onPress={() => { setLoginMethod('phone'); setError(''); }}
                  style={styles.switchButton}
                >
                  <Text style={styles.switchButtonText}>Continue with Phone</Text>
                </Pressable>

                <Pressable
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handlePasswordLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Sign in</Text>
                  )}
                </Pressable>
              </View>
            )}

            {/* Sign up link */}
            <Pressable onPress={() => router.push(`/signup?role=${roleTab}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}` as any)} style={styles.footerLink}>
              <Text style={styles.footerText}>No account? <Text style={styles.linkText}>Sign up</Text></Text>
            </Pressable>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#9CA3AF',
  },
  switchButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  switchButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#6B7280',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
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
    marginBottom: 4,
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
  forgotText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
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

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  modalTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    color: '#111827',
  },
  modalSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#2563EB',
  },
  modeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: '#6B7280',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  successCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
