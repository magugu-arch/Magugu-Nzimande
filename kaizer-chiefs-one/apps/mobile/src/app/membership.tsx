import { StyleSheet, View } from 'react-native';
import { maskMemberNumber, MAX_AGE_MS, type MemberAccount } from '@kc-one/contracts';
import {
  BackHeader,
  CrestSlot,
  DemoTag,
  Eyebrow,
  Group,
  Headline,
  ListRow,
  LoadingBlock,
  Notice,
  ProvenanceLine,
  QueryState,
  Screen,
  Text,
} from '@/components';
import { useEntitlements, useMember } from '@/data/queries';
import { SignInGate } from '@/features/auth/SignInGate';
import { color, radius, space } from '@/theme';

const STATE_COPY: Record<MemberAccount['verificationState'], { title: string; body: string }> = {
  not_linked: {
    title: 'Membership not linked',
    body: 'Link your membership once the club connects its membership system. Until then the app does not show any member status.',
  },
  pending: {
    title: 'Checking your membership',
    body: 'The membership system is verifying your details.',
  },
  verified: {
    title: 'Verified member',
    body: 'Your status and benefits come from the club’s membership system.',
  },
  expired: { title: 'Membership expired', body: 'Renew with the club to restore your benefits.' },
  failed: {
    title: 'We couldn’t verify you',
    body: 'Contact membership support to check your details.',
  },
};

/**
 * Digital Membership. Status and benefits come only from the membership
 * provider. The member number is never shown in full, and the card is not a
 * credential: entry and benefits are checked against the provider.
 */
export default function Membership() {
  const member = useMember();
  const ent = useEntitlements();
  return (
    <Screen topInset={false} header={<BackHeader title="Digital Membership" />}>
      <SignInGate
        title="Sign in for membership"
        body="Membership is linked to your supporter account."
      >
        <QueryState query={member} loading={<LoadingBlock lines={2} />}>
          {(m, provenance) => (
            <View style={{ gap: space.xl }}>
              <View
                style={styles.card}
                accessible
                accessibilityLabel={`Membership card. ${STATE_COPY[m.verificationState].title}.`}
              >
                <View style={styles.cardTop}>
                  <CrestSlot size={48} />
                  <View style={{ flex: 1 }}>
                    <Text variant="micro" color="accent">
                      Kaizer Chiefs
                    </Text>
                    <Text variant="display" style={{ fontSize: 30, lineHeight: 30 }}>
                      MEMBERSHIP
                    </Text>
                  </View>
                  {provenance.state === 'demo' ? <DemoTag /> : null}
                </View>
                <View style={styles.cardBottom}>
                  <View>
                    <Text variant="micro" color="textTertiary">
                      Number
                    </Text>
                    <Text variant="data">{maskMemberNumber(m.memberNumberLast4)}</Text>
                  </View>
                  <View>
                    <Text variant="micro" color="textTertiary">
                      Tier
                    </Text>
                    <Text variant="data">{m.tier ?? '—'}</Text>
                  </View>
                  <View>
                    <Text variant="micro" color="textTertiary">
                      Valid until
                    </Text>
                    <Text variant="data">
                      {m.validUntil ? new Date(m.validUntil).toLocaleDateString('en-ZA') : '—'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ gap: space.sm }}>
                <Eyebrow>Status</Eyebrow>
                <Headline lead={STATE_COPY[m.verificationState].title} size="display" />
                <Text variant="body" color="textSecondary">
                  {STATE_COPY[m.verificationState].body}
                </Text>
              </View>
              <Text variant="title3">Benefits</Text>
              <QueryState
                query={ent}
                loading={<LoadingBlock lines={1} />}
                unavailable={(reason, message) => <Notice compact reason={reason} body={message} />}
              >
                {(list) => (
                  <Group>
                    {list.map((e) => (
                      <ListRow
                        key={e.id}
                        icon="star-outline"
                        title={e.title}
                        subtitle={e.description}
                      />
                    ))}
                  </Group>
                )}
              </QueryState>
              <ProvenanceLine
                provenance={provenance}
                maxAgeMs={MAX_AGE_MS.membership}
                sourceLabel="Membership system"
              />
            </View>
          )}
        </QueryState>
      </SignInGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.xl,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.bgRaised,
    borderWidth: 1,
    borderColor: color.lineAccent,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
});
