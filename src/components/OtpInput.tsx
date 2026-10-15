import React, { useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { Fonts } from '../constants/theme';

interface OtpInputProps {
  /** Array of individual digit strings, e.g. ['', '', '', '', '', ''] */
  value: string[];
  /** Callback with updated array when a digit changes */
  onChange: (value: string[]) => void;
  /** Number of OTP digits (default 6) */
  length?: number;
  /** Auto-focus first input on mount */
  autoFocus?: boolean;
}

export default function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
}: OtpInputProps) {
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (autoFocus) {
      // Small delay to ensure the component is mounted
      const timer = setTimeout(() => {
        inputs.current[0]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const handleChange = (text: string, index: number) => {
    // Handle paste — if user pastes a full OTP
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, length).split('');
      const next = [...value];
      digits.forEach((d, i) => {
        if (index + i < length) {
          next[index + i] = d;
        }
      });
      onChange(next);
      // Focus the input after the last pasted digit
      const focusIndex = Math.min(index + digits.length, length - 1);
      inputs.current[focusIndex]?.focus();
      return;
    }

    // Only allow digits
    if (text && !/^\d$/.test(text)) return;

    const next = [...value];
    next[index] = text;
    onChange(next);

    // Auto-advance to next input
    if (text && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      // Move back and clear previous
      const next = [...value];
      next[index - 1] = '';
      onChange(next);
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length }, (_, i) => (
        <TextInput
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          style={[
            styles.input,
            value[i] ? styles.inputFilled : null,
          ]}
          value={value[i]}
          onChangeText={(text) => handleChange(text, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={Platform.OS === 'android' ? 1 : undefined}
          textContentType="oneTimeCode"
          autoComplete={i === 0 ? 'sms-otp' : 'off'}
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 52,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 22,
    fontFamily: Fonts.displaySemiBold,
    color: '#111827',
  },
  inputFilled: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
});
