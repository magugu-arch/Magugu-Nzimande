import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ProviderResult, Redemption } from '@kc-one/contracts';
import {
  BackHeader,
  Button,
  Column,
  ConceptImage,
  DemoTag,
  Eyebrow,
  Notice,
  QueryState,
  Screen,
  Text,
} from '@/components';
import { isImageKey } from '@/config/imagery';
import { newIdempotencyKey, useRedeem, useRewards } from '@/data/queries';
import { useSession } from '@/state/session';
import { color, radius, space } from '@/theme';

/**
 * Reward detail and redemption. Success is shown only when the rewards
 * provider confirms it, with its reference. Anything else is reported as it is.
 */
export default function RewardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const signedIn = useSession((s) => !!s.session);
  const rewards = useRewards();
  const redeem = useRedeem(id);
  // One key per attempt, kept across retries of the same attempt.
  const key = useRef<string | null>(null);
  const [result, setResult] = useState<ProviderResult<Redemption> | null>(null);

  async function go() {
    key.current ??= newIdempotencyKey();
    const r = await redeem.mutateAsync(key.current);
    setResult(r);
    // A definitive answer ends the attempt; the next tap is a new redemption.
    if (r.status === 'ok' && r.data.status !== 'pending') key.current = null;
  }

  return (
    <Screen topInset={false} header={<BackHeader title="Reward" />}>
      <QueryState query={rewards}>
        {(list) => {
          const r = list.find((x) => x.id === id);
          if (!r)
            return <Notice reason="error" title="Reward not available" body="It may have ended." />;
          return (
            <View style={{ gap: space.xl }}>
              {isImageKey(r.imageKey) ? (
                <ConceptImage imageKey={r.imageKey} style={styles.image} />
              ) : null}
              <Column style={{ paddingHorizontal: 0, gap: space.md }}>
                <Eyebrow>{r.category}</Eyebrow>
                <Text variant="title1">{r.title}</Text>
                {r.provenance.state === 'demo' ? <DemoTag kind="SAMPLE" /> : null}
                <Text variant="body" color="textSecondary">
                  {r.summary}
                </Text>
              </Column>
              <View style={styles.box}>
                <Text variant="labelSmall" color="accent">
                  Eligibility
                </Text>
                {r.eligibility.map((e) => (
                  <Text key={e} variant="callout">
                    — {e}
                  </Text>
                ))}
                <Text variant="labelSmall" color="accent" style={{ marginTop: space.md }}>
                  Terms
                </Text>
                <Text variant="footnote" color="textSecondary">
                  {r.terms}
                </Text>
              </View>

              {result?.status === 'ok' && result.data.status === 'confirmed' ? (
                <View style={styles.box}>
                  <Text variant="title3">Redeemed</Text>
                  <Text variant="callout" color="textSecondary">
                    Confirmed by Khosi Rewards. Reference {result.data.providerRef}.
                  </Text>
                </View>
              ) : result?.status === 'ok' && result.data.status === 'pending' ? (
                <Notice
                  compact
                  reason="integration_pending"
                  title="Processing"
                  body="Khosi Rewards has not confirmed this yet. Check back shortly; you will not be charged twice."
                />
              ) : result?.status === 'unavailable' ? (
                <Notice compact reason={result.reason} title="Not redeemed" body={result.message} />
              ) : null}

              {signedIn ? (
                <Button label="Redeem" onPress={go} loading={redeem.isPending} />
              ) : (
                <Button label="Sign in to redeem" onPress={() => router.push('/sign-in')} />
              )}
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: { height: 220, borderRadius: radius.md },
  box: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
});
