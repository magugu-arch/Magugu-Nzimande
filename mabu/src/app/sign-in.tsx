import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Wordmark } from '@/components/brand/Wordmark';
import { Header, InlineNotice, PremiumButton, Screen, Text, TextField } from '@/components/ui';
import { isEmail } from '@/domain/shared/validation';
import { errorMessage, rpc } from '@/services/api';
import { config } from '@/services/config';
import { DEMO_ACCOUNTS } from '@/services/demoSeed';
import { useBookingDraft } from '@/store/bookingDraft';
import { useSession } from '@/store/session';
import { spacing } from '@/theme';
import { haptic } from '@/utils/haptics';

const REASONS: Record<string, string> = {
  booking: 'Confirm your email to secure your table. It lets you manage the booking afterwards.',
  waitlist: 'Sign in so we can tell you the moment a table opens up.',
  rewards: 'Sign in to join MÁBU Rewards.',
  voucher: 'Sign in to buy a voucher — it will be kept safely in your profile.',
  event: 'Sign in to reserve your place.',
};

/**
 * §20 Auth: passwordless, one-time code by email. No password to forget, and
 * the email is proven before a booking is tied to it.
 */
export default function SignIn() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const draft = useBookingDraft();
  const signIn = useSession((s) => s.signIn);
  const client = useQueryClient();
  const [email, setEmail] = useState(draft.email);
  const [name, setName] = useState(draft.name);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mockCode, setMockCode] = useState<string | null>(null);

  const request = async () => {
    if (!isEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await rpc('auth.requestCode', { email });
      setMockCode(config.useMockApi ? res.mockCode : null);
      setStep('code');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await rpc('auth.verifyCode', {
        email,
        code,
        name: name || undefined,
        phone: draft.phone || undefined,
      });
      signIn({ token: res.token, actor: res.actor, name: res.guest.name, email: res.guest.email });
      haptic.success();
      client.clear();
      router.back();
    } catch (e) {
      haptic.warn();
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen meta={{ title: 'Sign in', noindex: true }} header={<Header title="Sign in" />}>
      <View style={{ alignItems: 'center', marginVertical: spacing.xxl }}>
        <Wordmark size={40} />
      </View>
      <Text variant="h2" align="center" accessibilityRole="header">
        {step === 'email' ? 'Welcome to Mábu' : 'Check your email'}
      </Text>
      <Text
        variant="body"
        color="textMuted"
        align="center"
        style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}
      >
        {step === 'email'
          ? ((reason && REASONS[reason]) ??
            'Sign in or create your account with just your email — no password needed.')
          : `We sent a six-digit code to ${email}.`}
      </Text>

      {step === 'email' ? (
        <>
          <TextField
            label="Email"
            testID="signin-email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => void request()}
          />
          <TextField
            label="Your name (new guests)"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            textContentType="name"
          />
          <PremiumButton
            label="Send my code"
            loading={busy}
            onPress={() => void request()}
            testID="signin-send"
          />
        </>
      ) : (
        <>
          <TextField
            label="Six-digit code"
            testID="signin-code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            onSubmitEditing={() => void verify()}
          />
          {mockCode ? (
            <InlineNotice tone="warning" style={{ marginBottom: spacing.lg }}>
              {`Demo mode: no email is sent. Your code is ${mockCode}.`}
            </InlineNotice>
          ) : null}
          <PremiumButton
            label="Sign in"
            loading={busy}
            disabled={code.length !== 6}
            onPress={() => void verify()}
            testID="signin-verify"
          />
          <PremiumButton
            label="Use a different email"
            variant="ghost"
            onPress={() => setStep('email')}
          />
        </>
      )}
      {error ? (
        <InlineNotice tone="danger" style={{ marginTop: spacing.lg }}>
          {error}
        </InlineNotice>
      ) : null}

      <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.lg }}>
        By continuing you agree to our{' '}
        <Text
          variant="caption"
          color="accent"
          accessibilityRole="link"
          // Underlined, not brass alone: a link inside a sentence must be
          // recognisable without seeing colour.
          style={{ textDecorationLine: 'underline' }}
          onPress={() => router.push('/legal/terms')}
        >
          terms of use
        </Text>{' '}
        and{' '}
        <Text
          variant="caption"
          color="accent"
          accessibilityRole="link"
          style={{ textDecorationLine: 'underline' }}
          onPress={() => router.push('/legal/privacy')}
        >
          privacy notice
        </Text>
        .
      </Text>

      {config.useMockApi && step === 'email' ? (
        <View style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
          <Text variant="eyebrow" color="textSubtle">
            Demo accounts
          </Text>
          <Text variant="caption" color="textSubtle">
            {`Guest with history: ${DEMO_ACCOUNTS.guest.email}\nFront of house: ${DEMO_ACCOUNTS.staff.email}\nAdmin: ${DEMO_ACCOUNTS.admin.email}`}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
