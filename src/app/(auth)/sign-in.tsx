import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button, Divider, Screen, Text, TextField } from '@/components/ui';
import { postAuthRoute } from '@/features/auth/postAuthRoute';
import { signIn } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';
import { validateEmail, validateFields, required } from '@/utils/validation';

type Field = 'email' | 'password';

export default function SignInScreen() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const continueAsGuest = useAuthStore((state) => state.continueAsGuest);

  const [values, setValues] = useState<Record<Field, string>>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = useCallback((field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    const validationErrors = validateFields(values, {
      email: validateEmail,
      password: required('Password'),
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const session = await signIn({ email: values.email, password: values.password });
      setSession(session);
      router.replace(postAuthRoute());
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'We could not sign you in.');
    } finally {
      setSubmitting(false);
    }
  }, [values, setSession, router]);

  const handleGuest = useCallback(() => {
    continueAsGuest();
    router.replace(postAuthRoute());
  }, [continueAsGuest, router]);

  return (
    <Screen scroll edges={['top', 'bottom']} testID="sign-in-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <BrandMark size="md" />
          <Text variant="h1">Welcome back</Text>
          <Text variant="body" color={colors.textSecondary}>
            Sign in to reorder your favourites, track deliveries and spend your points.
          </Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Email address"
            value={values.email}
            onChangeText={(text) => update('email', text)}
            error={errors.email ?? null}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="you@example.co.za"
            iconLeft="mail-outline"
            required
            testID="sign-in-email"
          />

          <TextField
            label="Password"
            value={values.password}
            onChangeText={(text) => update('password', text)}
            error={errors.password ?? null}
            secure
            autoComplete="current-password"
            textContentType="password"
            placeholder="Your password"
            iconLeft="lock-closed-outline"
            required
            testID="sign-in-password"
          />

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.forgot}
          >
            <Text variant="captionMedium" color={colors.primary}>
              Forgot your password?
            </Text>
          </Pressable>

          {formError ? (
            <View style={styles.formError} accessibilityRole="alert">
              <Text variant="caption" color={colors.status.error}>
                {formError}
              </Text>
            </View>
          ) : null}

          <Button
            label="Sign in"
            onPress={() => void handleSubmit()}
            loading={submitting}
            size="lg"
            testID="sign-in-submit"
          />

          <Divider label="or" />

          <Button
            label="Create an account"
            onPress={() => router.push('/(auth)/register')}
            variant="tertiary"
            size="lg"
          />

          <Button
            label="Continue as guest"
            onPress={handleGuest}
            variant="text"
            testID="sign-in-guest"
          />
        </View>

        <Text variant="caption" color={colors.textMuted} align="center" style={styles.legal}>
          By continuing you agree to our Terms of Use and Privacy Policy.
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  form: { gap: spacing.lg },
  forgot: { alignSelf: 'flex-end' },
  formError: {
    padding: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.status.errorSoft,
  },
  legal: { paddingVertical: spacing.xxl },
});
