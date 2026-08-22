import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Screen, ScreenHeader, Text, TextField } from '@/components/ui';
import { requestPasswordReset } from '@/services/authService';
import { colors, radius, spacing } from '@/theme';
import { validateEmail } from '@/utils/validation';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestPasswordReset(email);
      setSentTo(result.sentTo);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'We could not send that email.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [email]);

  if (sentTo) {
    return (
      <Screen edges={['top', 'bottom']} testID="forgot-password-sent">
        <ScreenHeader title="Check your inbox" />
        <View style={styles.confirmation}>
          <View style={styles.iconWell}>
            <Ionicons name="mail-open-outline" size={30} color={colors.primary} />
          </View>
          <Text variant="h2" align="center">
            Reset link sent
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center">
            If an account exists for {sentTo}, we have sent a link to reset your password. It
            expires in 30 minutes.
          </Text>
          <Button label="Back to sign in" onPress={() => router.replace('/(auth)/sign-in')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top', 'bottom']} testID="forgot-password-screen">
      <ScreenHeader title="Reset password" />

      <View style={styles.body}>
        <Text variant="body" color={colors.textSecondary}>
          Enter the email address on your account and we will send you a link to set a new password.
        </Text>

        <TextField
          label="Email address"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError(null);
          }}
          error={error}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="you@example.co.za"
          iconLeft="mail-outline"
          required
        />

        <Button
          label="Send reset link"
          onPress={() => void handleSubmit()}
          loading={submitting}
          size="lg"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, paddingTop: spacing.lg },
  confirmation: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  iconWell: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
});
