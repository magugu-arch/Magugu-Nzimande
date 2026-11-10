import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  FAN_REPORT_REASON_COPY,
  FAN_REPORT_REASONS,
  type FanReportReason,
} from '@kc-one/contracts';
import {
  BackHeader,
  Button,
  ConceptImage,
  DemoTag,
  EmptyState,
  ListRow,
  Group,
  Notice,
  QueryState,
  Screen,
  Sheet,
  Text,
} from '@/components';
import { isImageKey } from '@/config/imagery';
import { useFanFeed, useReportFanPost } from '@/data/queries';
import { useSession } from '@/state/session';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color, radius, space } from '@/theme';

export default function FanMoment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const feed = useFanFeed();
  const signedIn = useSession((s) => !!s.session);
  const report = useReportFanPost();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null);

  async function send(reason: FanReportReason) {
    const r = await report.mutateAsync({ postId: id, reason, details: null });
    setOpen(false);
    setOutcome(
      r.status === 'ok'
        ? { ok: true, message: 'Thanks. The moderation team will review it.' }
        : { ok: false, message: r.message },
    );
  }

  return (
    <Screen
      topInset={false}
      header={
        <BackHeader
          title="Fan Moment"
          right={
            <Button
              label="Report"
              variant="ghost"
              compact
              icon="flag-outline"
              onPress={() => (signedIn ? setOpen(true) : router.push('/sign-in'))}
            />
          }
        />
      }
    >
      <QueryState query={feed}>
        {(posts) => {
          const p = posts.find((x) => x.id === id);
          if (!p)
            return <EmptyState title="Moment not available" body="It may have been removed." />;
          return (
            <View style={{ gap: space.lg }}>
              <View style={styles.media}>
                {isImageKey(p.mediaRef) ? (
                  <ConceptImage imageKey={p.mediaRef} style={StyleSheet.absoluteFill} />
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                {p.provenance.state === 'demo' ? <DemoTag /> : null}
                <Text variant="footnote" color="textSecondary">
                  {p.authorDisplayName ?? 'A supporter'}
                </Text>
              </View>
              <Text variant="title3">{p.caption}</Text>
              {outcome ? (
                outcome.ok ? (
                  <View style={styles.ok}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={color.success} />
                    <Text variant="callout" style={{ flex: 1 }}>
                      {outcome.message}
                    </Text>
                  </View>
                ) : (
                  <Notice
                    compact
                    reason="demo_restricted"
                    title="Report not sent"
                    body={outcome.message}
                  />
                )
              ) : null}
            </View>
          );
        }}
      </QueryState>
      <Sheet visible={open} onClose={() => setOpen(false)} title="What’s wrong with this moment?">
        <Text variant="footnote" color="textSecondary" style={{ marginBottom: space.md }}>
          Reports are private. If someone is in immediate danger, contact emergency services.
        </Text>
        <Group>
          {FAN_REPORT_REASONS.map((r) => (
            <ListRow key={r} title={FAN_REPORT_REASON_COPY[r]} onPress={() => void send(r)} />
          ))}
        </Group>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  media: { aspectRatio: 0.8, borderRadius: radius.md, overflow: 'hidden' },
  ok: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
