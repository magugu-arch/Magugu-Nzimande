import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { fieldErrors, PASSWORD_MIN, registerSchema } from '@kc-one/contracts';
import { Button, Checkbox, Text, TextField } from '@/components';
import { auth } from '@/data/auth';
import { AuthScaffold } from '@/features/auth/AuthScaffold';
import { usePreferences } from '@/state/preferences';
import { useOnboarding, useSession } from '@/state/session';
import { space } from '@/theme';

export default function Register() {
  const router = useRouter();
  const setSession = useSession((s) => s.setSession);
  const finish = useOnboarding((s) => s.finish);
  const setPrivacy = usePreferences((s) => s.setPrivacy);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setFormError(null);
    const input = { displayName, email: email.trim(), password, acceptedTerms, marketingOptIn };
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    const r = await auth.register(parsed.data);
    setBusy(false);
    if (r.status !== 'ok') return setFormError(r.message);
    setPrivacy({ marketingEmail: parsed.data.marketingOptIn });
    setSession(r.data);
    finish('account');
    router.replace('/home');
  }

  return (
    <AuthScaffold
      eyebrow="Join the family"
      lead="One club."
      accent="One account."
      intro="Save stories, follow matches, keep your tickets and share Fan Moments."
    >
      <View style={{ gap: space.lg }}>
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="nickname"
          hint="Shown only where you choose, for example on Fan Moments."
          error={errors.displayName}
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          error={errors.email}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          hint={`At least ${PASSWORD_MIN} characters, with a letter and a number.`}
          error={errors.password}
        />
      </View>
      <View style={{ gap: space.md }}>
        <Checkbox
          checked={acceptedTerms}
          onChange={setAcceptedTerms}
          label="I accept the terms of use and have read the privacy notice"
          description="Draft documents, pending the club's legal review."
          error={errors.acceptedTerms}
        />
        <Checkbox
          checked={marketingOptIn}
          onChange={setMarketingOptIn}
          label="Send me club news and offers by email (optional)"
          description="You can change this at any time in Privacy."
        />
        <View style={{ flexDirection: 'row', gap: space.lg }}>
          <Button
            label="Terms"
            variant="ghost"
            compact
            onPress={() => router.push('/legal/terms')}
          />
          <Button
            label="Privacy notice"
            variant="ghost"
            compact
            onPress={() => router.push('/legal/privacy')}
          />
        </View>
      </View>
      {formError ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
          {formError}
        </Text>
      ) : null}
      <Button label="Create account" trailingIcon="arrow-forward" onPress={submit} loading={busy} />
      <Button
        label="I already have an account"
        variant="ghost"
        onPress={() => router.replace('/sign-in')}
      />
    </AuthScaffold>
  );
}
