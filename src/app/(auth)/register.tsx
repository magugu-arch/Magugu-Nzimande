import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, ScreenHeader, Text, TextField, Toggle } from '@/components/ui';
import { register } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';
import {
  minLength,
  required,
  validateEmail,
  validateFields,
  validatePassword,
  validatePhone,
} from '@/utils/validation';

type Field = 'firstName' | 'lastName' | 'email' | 'phone' | 'password';

export default function RegisterScreen() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const setPreference = useAuthStore((state) => state.setPreference);

  const [values, setValues] = useState<Record<Field, string>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [marketingConsent, setMarketingConsent] = useState(false);
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
      firstName: minLength('First name', 2),
      lastName: required('Last name'),
      email: validateEmail,
      phone: validatePhone,
      password: validatePassword,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      const session = await register({ ...values, marketingConsent });
      setSession(session);
      setPreference('marketingConsent', marketingConsent);
      // New accounts verify their number before landing in the app.
      router.replace({ pathname: '/(auth)/verify', params: { phone: values.phone } });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'We could not create your account.');
    } finally {
      setSubmitting(false);
    }
  }, [values, marketingConsent, setSession, setPreference, router]);

  return (
    <Screen scroll edges={['top', 'bottom']} testID="register-screen">
      <ScreenHeader title="Create account" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text variant="body" color={colors.textSecondary} style={styles.intro}>
          Join bb.q Rewards and start earning a point for every rand from your first order.
        </Text>

        <View style={styles.form}>
          <View style={styles.nameRow}>
            <TextField
              label="First name"
              value={values.firstName}
              onChangeText={(text) => update('firstName', text)}
              error={errors.firstName ?? null}
              autoComplete="given-name"
              textContentType="givenName"
              containerStyle={styles.nameField}
              required
              testID="register-first-name"
            />
            <TextField
              label="Last name"
              value={values.lastName}
              onChangeText={(text) => update('lastName', text)}
              error={errors.lastName ?? null}
              autoComplete="family-name"
              textContentType="familyName"
              containerStyle={styles.nameField}
              required
            />
          </View>

          <TextField
            label="Email address"
            value={values.email}
            onChangeText={(text) => update('email', text)}
            error={errors.email ?? null}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@example.co.za"
            iconLeft="mail-outline"
            required
          />

          <TextField
            label="Mobile number"
            value={values.phone}
            onChangeText={(text) => update('phone', text)}
            error={errors.phone ?? null}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="082 123 4567"
            helperText="We send order updates by SMS."
            iconLeft="call-outline"
            required
            testID="register-phone"
          />

          <TextField
            label="Password"
            value={values.password}
            onChangeText={(text) => update('password', text)}
            error={errors.password ?? null}
            secure
            autoComplete="new-password"
            helperText="At least 8 characters, with a letter and a number."
            iconLeft="lock-closed-outline"
            required
          />

          <Toggle
            label="Send me offers and news"
            description="Occasional emails about new drops and members-only deals. Unsubscribe anytime."
            value={marketingConsent}
            onValueChange={setMarketingConsent}
          />

          {formError ? (
            <View style={styles.formError} accessibilityRole="alert">
              <Text variant="caption" color={colors.status.error}>
                {formError}
              </Text>
            </View>
          ) : null}

          <Button
            label="Create account"
            onPress={() => void handleSubmit()}
            loading={submitting}
            size="lg"
            testID="register-submit"
          />

          <Text variant="caption" color={colors.textMuted} align="center">
            By creating an account you agree to our Terms of Use and Privacy Policy.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingBottom: spacing.xl },
  form: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  nameRow: { flexDirection: 'row', gap: spacing.md },
  nameField: { flex: 1 },
  formError: {
    padding: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.status.errorSoft,
  },
});
