import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { fieldErrors, signInSchema } from '@kc-one/contracts';
import { Button, Notice, Text, TextField } from '@/components';
import { auth } from '@/data/auth';
import { AuthScaffold } from '@/features/auth/AuthScaffold';
import { useOnboarding, useSession } from '@/state/session';
import { space } from '@/theme';

export default function SignIn() {
  const router = useRouter();
  const setSession = useSession((s) => s.setSession);
  const expiredNotice = useSession((s) => s.expiredNotice);
  const finish = useOnboarding((s) => s.finish);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setFormError(null);
    const parsed = signInSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    const r = await auth.signIn(parsed.data.email, parsed.data.password);
    setBusy(false);
    if (r.status !== 'ok') return setFormError(r.message);
    setSession(r.data);
    finish('account');
    router.replace('/home');
  }

  return (
    <AuthScaffold eyebrow="Welcome back" lead="Sign in," accent="Khosi.">
      {expiredNotice ? (
        <Notice
          compact
          reason="not_authenticated"
          title="Your session ended"
          body="For your security you were signed out after a period of time. Sign in again to continue."
        />
      ) : null}
      <View style={{ gap: space.lg }}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          error={errors.email}
          testID="signin-email"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="current-password"
          textContentType="password"
          error={errors.password}
          onSubmitEditing={submit}
          testID="signin-password"
        />
      </View>
      {formError ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
          {formError}
        </Text>
      ) : null}
      <View style={{ gap: space.md }}>
        <Button label="Sign in" onPress={submit} loading={busy} testID="signin-submit" />
        <Button
          label="Forgot password?"
          variant="ghost"
          onPress={() => router.push('/forgot-password')}
        />
        <Button
          label="Create an account"
          variant="secondary"
          onPress={() => router.replace('/register')}
        />
      </View>
    </AuthScaffold>
  );
}
