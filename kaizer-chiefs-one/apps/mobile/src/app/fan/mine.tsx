import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ownerCanDelete, type FanPost, type FanPostStatus } from '@kc-one/contracts';
import {
  BackHeader,
  Button,
  Card,
  DemoTag,
  EmptyState,
  LoadingBlock,
  Notice,
  Pill,
  QueryState,
  Screen,
  Sheet,
  Text,
} from '@/components';
import { useMyFanPosts, useRemoveFanPost } from '@/data/queries';
import { SignInGate } from '@/features/auth/SignInGate';
import { color, radius, space } from '@/theme';

const STATUS: Record<
  FanPostStatus,
  { label: string; tone: 'outline' | 'success' | 'danger' | 'accent' | 'neutral'; body: string }
> = {
  pending_review: { label: 'Pending review', tone: 'outline', body: 'Waiting for a moderator.' },
  escalated: { label: 'Safeguarding review', tone: 'accent', body: 'Held for an extra review.' },
  approved: { label: 'Approved', tone: 'success', body: 'Visible to supporters.' },
  rejected: { label: 'Not approved', tone: 'danger', body: 'This moment will not be shown.' },
  hidden: { label: 'Hidden', tone: 'neutral', body: 'Hidden by a moderator.' },
  removed_by_user: { label: 'Removed', tone: 'neutral', body: 'You removed this.' },
};

export default function MyMoments() {
  return (
    <Screen topInset={false} header={<BackHeader title="My moments" />}>
      <SignInGate
        title="Sign in to see your moments"
        body="Your submissions and their review status live in your account."
      >
        <List />
      </SignInGate>
    </Screen>
  );
}

function List() {
  const router = useRouter();
  const q = useMyFanPosts();
  const remove = useRemoveFanPost();
  const [confirm, setConfirm] = useState<FanPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <QueryState query={q} loading={<LoadingBlock lines={2} />}>
        {(posts) =>
          posts.length === 0 ? (
            <EmptyState
              icon="camera-outline"
              title="Nothing shared yet"
              body="Moments you submit appear here with their review status."
              action={{ label: 'Share a moment', onPress: () => router.push('/fan/new') }}
            />
          ) : (
            <View style={{ gap: space.md }}>
              {error ? <Notice compact reason="not_eligible" body={error} /> : null}
              {posts.map((p) => {
                const s = STATUS[p.status];
                return (
                  <Card key={p.id} style={styles.row}>
                    <Image
                      source={{ uri: p.mediaRef }}
                      style={styles.thumb}
                      contentFit="cover"
                      accessibilityLabel="Your moment"
                    />
                    <View style={{ flex: 1, gap: space.xs }}>
                      <Pill label={s.label} tone={s.tone} />
                      <Text variant="footnote" color="textSecondary">
                        {s.body}
                      </Text>
                      {p.caption ? (
                        <Text variant="callout" numberOfLines={2}>
                          {p.caption}
                        </Text>
                      ) : null}
                      {p.provenance.state === 'demo' ? <DemoTag /> : null}
                    </View>
                    {ownerCanDelete(p.status) ? (
                      <Button
                        label="Remove"
                        variant="ghost"
                        compact
                        onPress={() => setConfirm(p)}
                      />
                    ) : null}
                  </Card>
                );
              })}
            </View>
          )
        }
      </QueryState>
      <Sheet visible={!!confirm} onClose={() => setConfirm(null)} title="Remove this moment?">
        <View style={{ gap: space.md }}>
          <Text variant="callout" color="textSecondary">
            It will be taken down and deleted from storage. This cannot be undone.
          </Text>
          <Button
            label="Remove moment"
            variant="danger"
            loading={remove.isPending}
            onPress={async () => {
              if (!confirm) return;
              const r = await remove.mutateAsync(confirm.id);
              setError(r.status === 'ok' ? null : r.message);
              setConfirm(null);
            }}
          />
          <Button label="Keep it" variant="ghost" onPress={() => setConfirm(null)} />
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  thumb: { width: 72, height: 90, borderRadius: radius.sm, backgroundColor: color.surfaceHigh },
});
