import { useState } from 'react';
import { useRouter } from 'expo-router';
import { fieldErrors, forgotPasswordSchema } from '@kc-one/contracts';
import { Button, Notice, TextField } from '@/components';
import { auth } from '@/data/auth';
import { AuthScaffold } from '@/features/auth/AuthScaffold';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<
    { reason: 'demo_restricted' | 'integration_pending' | 'error'; message: string } | 'sent' | null
  >(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = forgotPasswordSchema.safeParse({ email: email.trim() });
    if (!parsed.success) return setError(fieldErrors(parsed.error).email);
    setError(undefined);
    setBusy(true);
    const r = await auth.requestPasswordReset(parsed.data.email);
    setBusy(false);
    if (r.status === 'ok') setResult('sent');
    else
      setResult({
        reason:
          r.reason === 'demo_restricted' || r.reason === 'integration_pending' ? r.reason : 'error',
        message: r.message,
      });
  }

  return (
    <AuthScaffold
      eyebrow="Account recovery"
      lead="Reset your"
      accent="password."
      intro="Enter the email on your account. If it matches, we'll send a link to set a new password."
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        error={error}
      />
      {result === 'sent' ? (
        <Notice
          reason="not_authenticated"
          title="Check your email"
          body="If an account uses that address, a reset link is on its way. It expires in 30 minutes."
        />
      ) : result ? (
        <Notice reason={result.reason} body={result.message} />
      ) : null}
      <Button label="Send reset link" onPress={submit} loading={busy} />
      <Button label="Back to sign in" variant="ghost" onPress={() => router.replace('/sign-in')} />
    </AuthScaffold>
  );
}
