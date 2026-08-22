import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { config } from '@/constants/config';
import { Button, Screen, ScreenHeader, Text } from '@/components/ui';
import { postAuthRoute } from '@/features/auth/postAuthRoute';
import { MOCK_OTP, requestOtp, verifyOtp } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing, typography } from '@/theme';
import { toE164 } from '@/utils/validation';

const CODE_LENGTH = 4;
const RESEND_SECONDS = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const { phone = '' } = useLocalSearchParams<{ phone?: string }>();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const code = digits.join('');

  const handleChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setError(null);
    setDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  }, []);

  const handleKeyPress = useCallback(
    (index: number, key: string) => {
      // Backspace on an empty box steps back to the previous one.
      if (key === 'Backspace' && digits[index] === '' && index > 0) {
        inputs.current[index - 1]?.focus();
      }
    },
    [digits],
  );

  const handleVerify = useCallback(async () => {
    if (code.length < CODE_LENGTH) {
      setError('Enter the 4-digit code');
      return;
    }

    setSubmitting(true);
    try {
      await verifyOtp(String(phone), code);
      if (user) setUser({ ...user, phone: toE164(String(phone)), phoneVerified: true });
      router.replace(postAuthRoute());
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'That code is not right.');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  }, [code, phone, user, setUser, router]);

  const handleResend = useCallback(async () => {
    setSecondsLeft(RESEND_SECONDS);
    setError(null);
    await requestOtp(String(phone));
  }, [phone]);

  return (
    <Screen scroll edges={['top', 'bottom']} testID="verify-screen">
      <ScreenHeader title="Verify your number" />

      <View style={styles.body}>
        <Text variant="body" color={colors.textSecondary}>
          We sent a 4-digit code to{' '}
          <Text variant="bodyMedium">{phone ? toE164(String(phone)) : 'your number'}</Text>. Enter
          it below to finish setting up your account.
        </Text>

        <View style={styles.codeRow}>
          {digits.map((digit, index) => (
            <TextInput
              key={index}
              ref={(element) => {
                inputs.current[index] = element;
              }}
              value={digit}
              onChangeText={(value) => handleChange(index, value)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={index === 0}
              accessibilityLabel={`Digit ${index + 1} of ${CODE_LENGTH}`}
              style={[
                styles.codeBox,
                digit ? styles.codeBoxFilled : null,
                error ? styles.codeBoxError : null,
              ]}
              testID={`otp-digit-${index}`}
            />
          ))}
        </View>

        {error ? (
          <Text
            variant="caption"
            color={colors.status.error}
            align="center"
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : null}

        {config.useMockApi ? (
          <View style={styles.hint}>
            <Text variant="caption" color={colors.textSecondary} align="center">
              Demo mode: the code is {MOCK_OTP}
            </Text>
          </View>
        ) : null}

        <Button
          label="Verify"
          onPress={() => void handleVerify()}
          loading={submitting}
          disabled={code.length < CODE_LENGTH}
          size="lg"
          testID="verify-submit"
        />

        <Button
          label={secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
          onPress={() => void handleResend()}
          variant="text"
          disabled={secondsLeft > 0}
          preserveCase
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, paddingTop: spacing.lg },
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  codeBox: {
    width: 62,
    height: 72,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    ...typography.h1,
    color: colors.textPrimary,
  },
  codeBoxFilled: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  codeBoxError: { borderColor: colors.status.error },
  hint: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
});
