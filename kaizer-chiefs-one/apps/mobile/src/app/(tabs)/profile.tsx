import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  AppHeader,
  Button,
  DemoTag,
  Eyebrow,
  Group,
  Headline,
  ListRow,
  Screen,
  Sheet,
  Text,
} from '@/components';
import { appVersion } from '@/config/env';
import { auth } from '@/data/auth';
import { useOnboarding, useSession } from '@/state/session';
import { color, radius, space } from '@/theme';

export default function Profile() {
  const router = useRouter();
  const session = useSession((s) => s.session);
  const reset = useOnboarding((s) => s.reset);
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  return (
    <Screen inTabs topInset={false} header={<AppHeader subline="Supporter profile" />}>
      <View style={{ gap: space.xl }}>
        {session ? (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text variant="display" color="onAccent">
                {session.displayName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title3">{session.displayName}</Text>
              <Text variant="footnote" color="textSecondary">
                {session.email}
              </Text>
              {session.isDemo ? (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: space.sm,
                    alignItems: 'center',
                    marginTop: space.xs,
                  }}
                >
                  <DemoTag />
                  <Text variant="micro" color="textTertiary">
                    Local demo session
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={{ gap: space.lg }}>
            <Eyebrow>Guest</Eyebrow>
            <Headline lead="Make it" accent="yours." size="display" />
            <Text variant="body" color="textSecondary">
              With an account you keep your tickets, membership, saved stories and Fan Moments in
              one place. Browsing stays free without one.
            </Text>
            <Button
              label="Create an account"
              trailingIcon="arrow-forward"
              onPress={() => router.push('/register')}
            />
            <Button label="Sign in" variant="secondary" onPress={() => router.push('/sign-in')} />
          </View>
        )}

        <Group>
          <ListRow
            icon="card-outline"
            title="Digital Membership"
            subtitle="Status and benefits"
            onPress={() => router.push('/membership')}
          />
          <ListRow
            icon="ticket-outline"
            title="Ticket Wallet"
            onPress={() => router.push('/tickets')}
          />
          <ListRow
            icon="gift-outline"
            title="Khosi Rewards"
            onPress={() => router.push('/rewards')}
          />
          <ListRow
            icon="bookmark-outline"
            title="Saved stories"
            onPress={() => router.push('/saved')}
          />
        </Group>

        <Group>
          <ListRow
            icon="notifications-outline"
            title="Notifications"
            subtitle="Inbox"
            onPress={() => router.push('/notifications')}
          />
          <ListRow
            icon="options-outline"
            title="Notification preferences"
            onPress={() => router.push('/settings/notifications')}
          />
          <ListRow
            icon="shield-checkmark-outline"
            title="Privacy"
            subtitle="Consents, your data"
            onPress={() => router.push('/settings/privacy')}
          />
          {session ? (
            <ListRow
              icon="person-outline"
              title="Account"
              onPress={() => router.push('/settings/account')}
            />
          ) : null}
        </Group>

        <Group>
          <ListRow
            icon="help-buoy-outline"
            title="Help and contact"
            onPress={() => router.push('/help')}
          />
          <ListRow
            icon="document-text-outline"
            title="Terms of use"
            onPress={() => router.push('/legal/terms')}
          />
          <ListRow
            icon="lock-closed-outline"
            title="Privacy notice"
            onPress={() => router.push('/legal/privacy')}
          />
          <ListRow
            icon="people-outline"
            title="Community rules"
            onPress={() => router.push('/legal/community')}
          />
          <ListRow
            icon="information-circle-outline"
            title="About this app"
            value={`v${appVersion}`}
            onPress={() => router.push('/about')}
          />
        </Group>

        {session ? (
          <Button label="Sign out" variant="secondary" onPress={() => setConfirm(true)} />
        ) : (
          <Button
            label="Show the welcome screen"
            variant="ghost"
            onPress={() => {
              reset();
              router.replace('/welcome');
            }}
          />
        )}
      </View>

      <Sheet visible={confirm} onClose={() => setConfirm(false)} title="Sign out?">
        <View style={{ gap: space.md }}>
          <Text variant="callout" color="textSecondary">
            Your tickets and membership stay in your account. Anything only on this phone, such as
            preferences, stays here.
          </Text>
          <Button
            label="Sign out"
            onPress={async () => {
              await auth.signOut();
              qc.clear();
              setConfirm(false);
              router.replace('/home');
            }}
          />
          <Button label="Cancel" variant="ghost" onPress={() => setConfirm(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineAccent,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
