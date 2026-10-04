import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { providers } from '@/core/adapters/registry';
import { useMentoring } from '@/data/hooks';
import {
  Button,
  Card,
  Header,
  Icon,
  Notice,
  Photo,
  Pill,
  QueryState,
  Row,
  Screen,
  StateView,
  Text,
  colors,
  radius,
  spacing,
} from '@/design';
import { useSession } from '@/state/session';
import { showToast } from '@/state/toasts';

/** Mentoring (brief §14, §26 step 13): a clear ask, a clear commitment, one decision. */
export default function Mentoring() {
  const queryClient = useQueryClient();
  const userId = useSession((s) => s.user?.id);
  const role = useSession((s) => s.role);
  const mentoring = useMentoring();
  const [busy, setBusy] = useState<string | null>(null);

  const respond = async (id: string, accept: boolean) => {
    setBusy(id);
    try {
      await providers.alumni.respondToMentoring(id, accept);
      showToast({ title: accept ? 'You’re a mentor — thank you' : 'Declined — we won’t ask again for this one', tone: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['mentoring', userId, role] });
    } catch {
      showToast({ title: 'That didn’t save — please try again', tone: 'info' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen header={<Header title="Mentoring" fallbackHref="/alumni" />} testID="mentoring">
      <Photo photo="alumniMentorship" size="md" style={styles.photo} />
      <Text variant="title1" accessibilityRole="header">
        An hour a month can change a degree
      </Text>
      <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.lg }}>
        Students ask for mentors in fields like yours. You decide; nothing is shared until you accept.
      </Text>
      <QueryState query={mentoring} what="mentoring requests" isEmpty={(m) => m.length === 0} empty={<StateView kind="empty" title="No requests right now" body="We’ll notify you when a student asks for someone with your experience." />}>
        {(list) => (
          <View style={{ gap: spacing.md }}>
            {list.map((m) => (
              <Card key={m.id} testID={`mentoring-${m.id}`}>
                <Row justify="space-between">
                  <Text variant="overline" color={colors.textSecondary}>
                    {m.field}
                  </Text>
                  <Pill label={m.status === 'open' ? 'New request' : m.status === 'accepted' ? 'Accepted' : 'Declined'} tone={m.status === 'open' ? 'yellow' : m.status === 'accepted' ? 'success' : 'neutral'} />
                </Row>
                <Text variant="title3" style={{ marginTop: spacing.xs }}>
                  {m.title}
                </Text>
                <Text variant="body">{m.menteeSummary}</Text>
                <View style={styles.facts}>
                  <Row gap={spacing.sm}>
                    <Icon name="time-outline" size={18} color={colors.navy2} />
                    <Text variant="caption">{m.commitment}</Text>
                  </Row>
                  <Row gap={spacing.sm} align="flex-start">
                    <Icon name="sparkles-outline" size={18} color={colors.navy2} />
                    <Text variant="caption" style={{ flex: 1 }}>
                      Why you: {m.matchReason}
                    </Text>
                  </Row>
                </View>
                {m.status === 'open' ? (
                  <Row gap={spacing.sm} wrap>
                    <Button label="Accept" icon="checkmark" variant="accent" size="md" loading={busy === m.id} onPress={() => respond(m.id, true)} testID="mentoring-accept" />
                    <Button label="Not now" variant="ghost" size="md" disabled={busy === m.id} onPress={() => respond(m.id, false)} />
                  </Row>
                ) : m.status === 'accepted' ? (
                  <Notice tone="success" title="You’re matched" body="Your introduction will arrive in NMU ONE notifications. Thank you for giving your time." />
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { height: 170, marginBottom: spacing.lg },
  facts: { gap: spacing.sm, marginVertical: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSunken },
});
