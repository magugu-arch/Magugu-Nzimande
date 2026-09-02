import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Screen,
  ScreenHeader,
  Text,
  TextField,
} from '@/components/ui';
import { deleteAccount, requestEmailVerification, updateProfile } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { useSignOut } from '@/features/system/useSignOut';
import { colors, radius, spacing } from '@/theme';
import { formatShortDate } from '@/utils/datetime';
import { ask, tell } from '@/ux/dialog';
import {
  minLength,
  required,
  validateEmail,
  validateFields,
  validatePhone,
} from '@/utils/validation';

type Field = 'firstName' | 'lastName' | 'email' | 'phone';

/** Profile (brief §4). */
export default function ProfileScreen() {
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const setUser = useAuthStore((state) => state.setUser);
  const { forgetLocally } = useSignOut();

  const [values, setValues] = useState<Record<Field, string>>({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const update = useCallback((field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    // The screen renders a sign-in prompt instead when there is nobody to
    // edit, so this is unreachable — but the patch has to be applied to
    // somebody, and that somebody is not going to be guessed at.
    if (!user) return;

    const validationErrors = validateFields(values, {
      firstName: minLength('First name', 2),
      lastName: required('Last name'),
      email: validateEmail,
      phone: validatePhone,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile(values, user);
      setUser(updated);
      setSaved(true);
    } catch (error) {
      void tell(
        'Could not save',
        error instanceof Error ? error.message : 'Please try again shortly.',
      );
    } finally {
      setSaving(false);
    }
  }, [values, user, setUser]);

  const handleVerifyEmail = useCallback(async () => {
    if (!user) return;
    setSendingVerification(true);
    try {
      await requestEmailVerification(user.email);
      setEmailSent(true);
    } catch (error) {
      void tell(
        'Could not send that',
        error instanceof Error ? error.message : 'Please try again shortly.',
      );
    } finally {
      setSendingVerification(false);
    }
  }, [user]);

  const handleDelete = useCallback(async () => {
    const confirmed = await ask({
      title: 'Delete your account?',
      message:
        'We remove your personal data within 30 days, keeping only what tax law requires. This cannot be undone.',
      confirmLabel: 'Delete account',
      cancelLabel: 'Keep my account',
      destructive: true,
    });
    if (!confirmed) return;

    /**
     * The dialogue above promises erasure within thirty days. This used to
     * call `signOut` — so nothing was ever asked of anyone, and the promise
     * was a sentence on a screen.
     *
     * A failure is not swallowed the way a failed sign-out is. If the request
     * did not land the account still exists, and leaving somebody signed out
     * believing their data is gone is the worse of the two wrong answers by a
     * distance.
     */
    try {
      await deleteAccount();
    } catch (error) {
      void tell(
        'We could not delete your account',
        error instanceof Error
          ? `${error.message} Your account is still here — please try again, or contact us.`
          : 'Your account is still here — please try again, or contact us.',
      );
      return;
    }

    // The account is gone, so there is no session left to sign out of — only
    // this handset's memory of it to clear.
    forgetLocally();
  }, [forgetLocally]);

  if (!user || isGuest) {
    return (
      <Screen edges={['top', 'bottom']} testID="profile-guest">
        <ScreenHeader title="Profile" />
        <EmptyState
          icon="person-outline"
          title="Sign in to see your profile"
          message="Create an account or sign in to save your details, addresses and rewards."
          actionLabel="Sign in"
          onActionPress={() => router.push('/(auth)/sign-in')}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top', 'bottom']} testID="profile-screen">
      <ScreenHeader title="Profile" />

      <View style={styles.body}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text variant="h1" color={colors.onPrimary}>
              {user.avatarInitials}
            </Text>
          </View>
          <Text variant="caption" color={colors.textMuted}>
            Member since {formatShortDate(user.createdAt)}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.row}>
            <TextField
              label="First name"
              value={values.firstName}
              onChangeText={(text) => update('firstName', text)}
              error={errors.firstName ?? null}
              containerStyle={styles.rowField}
              autoComplete="given-name"
              required
            />
            <TextField
              label="Last name"
              value={values.lastName}
              onChangeText={(text) => update('lastName', text)}
              error={errors.lastName ?? null}
              containerStyle={styles.rowField}
              autoComplete="family-name"
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
            iconLeft="mail-outline"
            required
          />
          {/*
            An unverified email used to be a warning badge and nothing else —
            permanent by construction, since `register` creates every customer
            unverified and no screen offered a way out. The mobile number two
            fields below already had the answer: a badge when it is done, a
            button when it is not.
          */}
          {user.emailVerified ? (
            <Badge label="Email verified" tone="success" icon="checkmark-circle" />
          ) : (
            <View style={styles.verifyRow}>
              <Badge label="Email not verified" tone="warning" icon="alert-circle" />
              <Button
                label={emailSent ? 'Verification email sent' : 'Send me the link'}
                onPress={() => void handleVerifyEmail()}
                loading={sendingVerification}
                disabled={emailSent}
                variant="text"
                size="sm"
                fullWidth={false}
              />
            </View>
          )}

          <TextField
            label="Mobile number"
            value={values.phone}
            onChangeText={(text) => update('phone', text)}
            error={errors.phone ?? null}
            keyboardType="phone-pad"
            autoComplete="tel"
            iconLeft="call-outline"
            required
          />
          {user.phoneVerified ? (
            <Badge label="Number verified" tone="success" icon="checkmark-circle" />
          ) : (
            <Button
              label="Verify my number"
              onPress={() =>
                router.push({ pathname: '/(auth)/verify', params: { phone: values.phone } })
              }
              variant="text"
              size="sm"
              fullWidth={false}
            />
          )}

          {saved ? (
            <View style={styles.savedNotice}>
              <Text variant="caption" color={colors.status.success}>
                Saved. Your details are up to date.
              </Text>
            </View>
          ) : null}

          <Button
            label="Save changes"
            onPress={() => void handleSave()}
            loading={saving}
            size="lg"
            testID="profile-save"
          />
        </View>

        <Divider />

        <Card style={styles.dangerCard}>
          <Text variant="h3">Delete your account</Text>
          <Text variant="caption" color={colors.textSecondary}>
            This removes your profile, addresses and saved payment methods. Your points and
            unredeemed rewards are lost.
          </Text>
          <Button
            label="Delete account"
            onPress={handleDelete}
            variant="tertiary"
            iconLeft="trash-outline"
            testID="profile-delete"
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, paddingBottom: spacing.xxxl },
  identity: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  form: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  rowField: { flex: 1 },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  savedNotice: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.status.successSoft,
  },
  dangerCard: { gap: spacing.md },
});
