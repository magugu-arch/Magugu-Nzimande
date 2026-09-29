import { View } from 'react-native';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  Card,
  Header,
  InlineNotice,
  LoadingBlock,
  PremiumButton,
  Screen,
  SectionTitle,
  Text,
} from '@/components/ui';
import { formatDateShort, formatTime } from '@/domain/shared/format';
import { errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

/**
 * §19: where the guest is signed in, and how to end a session they do not
 * recognise. Sign-in is by one-time code, so there is no password to change —
 * ending the other sessions is what takes a lost phone away.
 */
export default function SecurityScreen() {
  const q = useRpc('auth.sessions');
  const signOutOthers = useRpcMutation('auth.signOutOthers', ['auth.sessions']);
  const email = useSession((s) => s.email);
  const others = (q.data?.sessions ?? []).filter((s) => !s.current).length;

  return (
    <Screen
      meta={{ title: 'Sign-ins and devices', noindex: true }}
      header={<Header title="Sign-ins and devices" />}
    >
      <Text variant="body" color="textMuted" style={{ marginTop: spacing.md }}>
        You sign in with a code sent to {email || 'your email address'} — there is no password to
        lose. A code lasts ten minutes and can be tried five times.
      </Text>

      <SectionTitle eyebrow="Devices" title="Where you are signed in" />
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <InlineNotice tone="danger">{errorMessage(q.error)}</InlineNotice>
      ) : (
        (q.data?.sessions ?? []).map((s) => (
          <Card key={s.id} style={{ marginBottom: spacing.sm, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Feather name="smartphone" size={16} color={colors.accent} />
              <Text variant="title" style={{ flex: 1 }}>
                {s.label}
              </Text>
              {s.current ? (
                <Text variant="eyebrow" color="accent">
                  This device
                </Text>
              ) : null}
            </View>
            <Text variant="caption" color="textMuted">
              Signed in {formatDateShort(s.createdAt)} · last used {formatDateShort(s.lastSeenAt)}{' '}
              at {formatTime(s.lastSeenAt)}
            </Text>
          </Card>
        ))
      )}

      {others ? (
        <PremiumButton
          label={`Sign out everywhere else (${others})`}
          variant="secondary"
          loading={signOutOthers.isPending}
          style={{ marginTop: spacing.md }}
          onPress={() => signOutOthers.mutate(undefined)}
        />
      ) : (
        <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.sm }}>
          No other device is signed in to your account.
        </Text>
      )}
      {signOutOthers.isError ? (
        <InlineNotice tone="danger" style={{ marginTop: spacing.md }}>
          {errorMessage(signOutOthers.error)}
        </InlineNotice>
      ) : null}

      <SectionTitle eyebrow="How we protect your account" title="What we do" />
      {[
        'Sign-in codes and session keys are stored scrambled, so they cannot be read back.',
        'A staff sign-in lasts twelve hours; changes to money or policy need a sign-in from the last half hour.',
        'We never see your card. Payments are taken on our payment partner’s secure page.',
        'Sensitive staff actions are recorded in an audit log.',
      ].map((line) => (
        <View
          key={line}
          style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}
        >
          <Feather name="shield" size={15} color={colors.accent} style={{ marginTop: 3 }} />
          <Text variant="bodySmall" color="textMuted" style={{ flex: 1 }}>
            {line}
          </Text>
        </View>
      ))}
      <PremiumButton
        label="Read our privacy notice"
        variant="ghost"
        compact
        style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
        onPress={() => router.push('/legal/privacy')}
      />
    </Screen>
  );
}
