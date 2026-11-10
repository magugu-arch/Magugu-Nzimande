import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { BackHeader, Button, Group, ListRow, Notice, Screen, Sheet, Text } from '@/components';
import { auth } from '@/data/auth';
import { SignInGate } from '@/features/auth/SignInGate';
import { useDemoFan } from '@/state/demoFan';
import { usePreferences } from '@/state/preferences';
import { useOnboarding, useSession } from '@/state/session';
import { space } from '@/theme';
import type { UnavailableReason } from '@kc-one/contracts';

export default function Account() {
  return (
    <Screen topInset={false} header={<BackHeader title="Account" />}>
      <SignInGate
        title="Sign in to manage your account"
        body="Account settings belong to a signed-in supporter."
      >
        <AccountBody />
      </SignInGate>
    </Screen>
  );
}

function AccountBody() {
  const router = useRouter();
  const qc = useQueryClient();
  const session = useSession((s) => s.session);
  const [notice, setNotice] = useState<{ reason: UnavailableReason; message: string } | null>(null);
  const [wipe, setWipe] = useState(false);
  if (!session) return null;
  const expires = new Date(session.expiresAt).toLocaleString('en-ZA');
  return (
    <View style={{ gap: space.xl }}>
      <Group>
        <ListRow title="Display name" value={session.displayName} />
        <ListRow title="Email" value={session.email} />
        <ListRow title="Session ends" value={expires} />
      </Group>
      {notice ? <Notice compact reason={notice.reason} body={notice.message} /> : null}
      <Group>
        <ListRow
          icon="download-outline"
          title="Request a copy of your data"
          subtitle="Sent to your email by the club's privacy team."
          onPress={() =>
            setNotice({
              reason: session.isDemo ? 'demo_restricted' : 'integration_pending',
              message: session.isDemo
                ? 'The demo holds no account data on any server. Everything is on this phone.'
                : 'Data requests go to the club’s privacy team once connected.',
            })
          }
        />
        <ListRow
          icon="trash-outline"
          title="Delete your account"
          destructive
          onPress={async () => {
            const r = await auth.requestAccountDeletion();
            if (r.status === 'unavailable') setNotice({ reason: r.reason, message: r.message });
          }}
        />
      </Group>
      {session.isDemo ? (
        <View style={{ gap: space.sm }}>
          <Text variant="footnote" color="textSecondary">
            Demo builds keep everything on this phone. You can clear it completely.
          </Text>
          <Button
            label="Delete demo data on this phone"
            variant="danger"
            onPress={() => setWipe(true)}
          />
        </View>
      ) : null}
      <Sheet visible={wipe} onClose={() => setWipe(false)} title="Delete demo data?">
        <View style={{ gap: space.md }}>
          <Text variant="callout" color="textSecondary">
            This signs you out and removes demo Fan Moments, saved stories and preferences from this
            phone.
          </Text>
          <Button
            label="Delete and sign out"
            variant="danger"
            onPress={() => {
              useDemoFan.getState().clear();
              usePreferences.getState().resetAll();
              useSession.getState().signOut('user');
              useOnboarding.getState().reset();
              qc.clear();
              setWipe(false);
              router.replace('/welcome');
            }}
          />
          <Button label="Cancel" variant="ghost" onPress={() => setWipe(false)} />
        </View>
      </Sheet>
    </View>
  );
}
