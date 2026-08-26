import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, EmptyState, Screen, ScreenHeader, Text, TextField } from '@/components/ui';
import { confirmPasswordReset } from '@/services/authService';
import { colors, radius, spacing } from '@/theme';
import { validatePassword } from '@/utils/validation';

/**
 * Where the link in the reset email lands.
 *
 * There was nowhere. `forgot-password` told the customer "we have sent a link
 * to reset your password", and no route matched it — so expo-router sent them
 * to `+not-found`: "This page has moved on. We couldn't find what you were
 * looking for. It may have been taken off the menu." Somebody locked out of
 * their own account, told their password reset was off the menu.
 *
 * The token comes off the link and goes straight back to the server with the
 * new password. This screen does not read it, check it or keep it: whether a
 * reset token is still good is a judgement for the side that issued it, and an
 * app that second-guesses it can only get that wrong in one direction.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmation?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = useCallback(async () => {
    const passwordError = validatePassword(password);
    // Checked here rather than server-side, because the server only ever
    // receives one of them: a customer who mistypes the second box would
    // otherwise be given a password they do not know they have.
    const confirmationError =
      confirmation.length === 0
        ? 'Type your new password again'
        : confirmation !== password
          ? 'Those passwords do not match'
          : undefined;

    if (passwordError || confirmationError) {
      setErrors({
        ...(passwordError ? { password: passwordError } : {}),
        ...(confirmationError ? { confirmation: confirmationError } : {}),
      });
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await confirmPasswordReset(String(token ?? ''), password);
      setDone(true);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'We could not set that password. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [password, confirmation, token]);

  /**
   * A link with no token on it cannot be completed, and saying so at the top
   * beats letting somebody choose a password and then refusing it.
   *
   * Reachable by an email client that truncates the URL, by a customer typing
   * the address by hand, and by anyone who opens the route directly.
   */
  if (!token || String(token).trim().length === 0) {
    return (
      <Screen edges={['top', 'bottom']} testID="reset-password-no-token">
        <ScreenHeader title="Reset password" />
        <EmptyState
          icon="link-outline"
          title="That link is incomplete"
          message="Open the link from the email exactly as it arrived, or ask for a new one."
          actionLabel="Send a new link"
          onActionPress={() => router.replace('/(auth)/forgot-password')}
        />
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen edges={['top', 'bottom']} testID="reset-password-done">
        <ScreenHeader title="Password changed" />
        <View style={styles.confirmation}>
          <View style={styles.iconWell}>
            <Ionicons name="lock-open-outline" size={30} color={colors.primary} />
          </View>
          <Text variant="h2" align="center">
            You are set
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center">
            Sign in with your new password. Any other device that was signed in will need it too.
          </Text>
          <Button
            label="Sign in"
            onPress={() => router.replace('/(auth)/sign-in')}
            testID="reset-password-sign-in"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top', 'bottom']} testID="reset-password-screen">
      <ScreenHeader title="Choose a new password" />

      <View style={styles.body}>
        <Text variant="body" color={colors.textSecondary}>
          Pick something you have not used here before. At least 8 characters, with a letter and a
          number.
        </Text>

        <TextField
          label="New password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setErrors((current) => ({ ...current, password: undefined }));
            setFormError(null);
          }}
          error={errors.password ?? null}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          iconLeft="lock-closed-outline"
          required
          testID="reset-password-new"
        />

        <TextField
          label="Type it again"
          value={confirmation}
          onChangeText={(text) => {
            setConfirmation(text);
            setErrors((current) => ({ ...current, confirmation: undefined }));
            setFormError(null);
          }}
          error={errors.confirmation ?? null}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          iconLeft="lock-closed-outline"
          required
          testID="reset-password-confirm"
        />

        {formError ? (
          <View style={styles.formError} accessibilityRole="alert">
            <Text variant="caption" color={colors.status.error}>
              {formError}
            </Text>
          </View>
        ) : null}

        <Button
          label="Set new password"
          onPress={() => void handleSubmit()}
          loading={submitting}
          size="lg"
          testID="reset-password-submit"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingTop: spacing.lg },
  formError: {
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.status.errorSoft,
  },
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
