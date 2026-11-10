import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MAX_AGE_MS } from '@kc-one/contracts';
import {
  BackHeader,
  ConceptImage,
  DemoTag,
  Eyebrow,
  Headline,
  LoadingBlock,
  Notice,
  PressableScale,
  ProvenanceLine,
  QueryState,
  Screen,
  Text,
} from '@/components';
import { isImageKey } from '@/config/imagery';
import { useRewards, useWallet } from '@/data/queries';
import { useSession } from '@/state/session';
import { color, radius, space } from '@/theme';

export default function Rewards() {
  const router = useRouter();
  const signedIn = useSession((s) => !!s.session);
  const wallet = useWallet();
  const rewards = useRewards();
  return (
    <Screen topInset={false} header={<BackHeader title="Khosi Rewards" />}>
      <View style={{ gap: space.xl }}>
        <Eyebrow>Khosi Rewards</Eyebrow>
        <Headline lead="Loyalty," accent="rewarded." size="display" />
        {signedIn ? (
          <QueryState
            query={wallet}
            loading={<LoadingBlock lines={0} />}
            unavailable={(reason, message) => (
              <Notice compact reason={reason} title="Points balance unavailable" body={message} />
            )}
          >
            {(w, p) => (
              <View style={styles.wallet}>
                <Text variant="micro" color="textTertiary">
                  Your balance
                </Text>
                <Text variant="score">{w.balance.toLocaleString('en-ZA')}</Text>
                <ProvenanceLine
                  provenance={p}
                  maxAgeMs={MAX_AGE_MS.rewards}
                  sourceLabel="Khosi Rewards"
                />
              </View>
            )}
          </QueryState>
        ) : (
          <Notice
            compact
            reason="not_authenticated"
            body="Sign in to see your points and redeem rewards."
            action={{ label: 'Sign in', onPress: () => router.push('/sign-in') }}
          />
        )}
        <Text variant="title3">Catalogue</Text>
        <QueryState query={rewards} loading={<LoadingBlock lines={2} />}>
          {(list, provenance) => (
            <View style={{ gap: space.md }}>
              {list.map((r) => (
                <PressableScale
                  key={r.id}
                  onPress={() => router.push(`/rewards/${r.id}`)}
                  accessibilityLabel={`${r.title}. ${r.summary}${r.provenance.state === 'demo' ? ' Sample reward.' : ''}`}
                  pressedScale={0.98}
                  style={styles.row}
                >
                  {isImageKey(r.imageKey) ? (
                    <ConceptImage
                      imageKey={r.imageKey}
                      style={styles.thumb}
                      decorative
                      tag="none"
                    />
                  ) : null}
                  <View style={{ flex: 1, gap: space.xs, padding: space.md }}>
                    <Text variant="micro" color="accent">
                      {r.category}
                    </Text>
                    <Text variant="headline">{r.title}</Text>
                    <Text variant="footnote" color="textSecondary" numberOfLines={2}>
                      {r.summary}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                      {r.provenance.state === 'demo' ? <DemoTag kind="SAMPLE" /> : null}
                      <Text variant="micro" color="textTertiary">
                        {r.pointsCost
                          ? `${r.pointsCost.toLocaleString('en-ZA')} points`
                          : 'Points set by programme'}
                      </Text>
                    </View>
                  </View>
                </PressableScale>
              ))}
              <ProvenanceLine
                provenance={provenance}
                maxAgeMs={MAX_AGE_MS.rewards}
                sourceLabel="Khosi Rewards"
              />
            </View>
          )}
        </QueryState>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wallet: {
    gap: space.xs,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.bgRaised,
    borderWidth: 1,
    borderColor: color.lineAccent,
  },
  row: {
    flexDirection: 'row',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  thumb: { width: 104 },
});
