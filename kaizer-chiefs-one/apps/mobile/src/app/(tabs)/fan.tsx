import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MAX_AGE_MS } from '@kc-one/contracts';
import {
  AppHeader,
  Button,
  Card,
  ConceptImage,
  DemoTag,
  EmptyState,
  Eyebrow,
  Headline,
  LoadingBlock,
  PressableScale,
  ProvenanceLine,
  QueryState,
  Screen,
  SectionTitle,
  Text,
} from '@/components';
import { isImageKey } from '@/config/imagery';
import { useFanFeed } from '@/data/queries';
import { useSession } from '@/state/session';
import { color, radius, space } from '@/theme';

export default function Fan() {
  const router = useRouter();
  const signedIn = useSession((s) => !!s.session);
  const feed = useFanFeed();
  return (
    <Screen inTabs topInset={false} header={<AppHeader subline="Fan Moments · Community" />}>
      <View style={{ gap: space.xl }}>
        <Eyebrow>Supporter community</Eyebrow>
        <Headline lead="Your matchday," accent="shared." size="display" />
        <Text variant="body" color="textSecondary">
          Share a photo or a short video from the stands. Every moment is reviewed by the club’s
          moderation team before anyone else can see it, and you can remove yours at any time.
        </Text>
        <View style={{ gap: space.md }}>
          <Button
            label="Share a moment"
            icon="camera-outline"
            onPress={() => router.push(signedIn ? '/fan/new' : '/sign-in')}
            accessibilityHint={signedIn ? undefined : 'You need to sign in first'}
          />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button
              label="My moments"
              variant="secondary"
              compact
              style={{ flex: 1 }}
              onPress={() => router.push('/fan/mine')}
            />
            <Button
              label="Community rules"
              variant="secondary"
              compact
              style={{ flex: 1 }}
              onPress={() => router.push('/legal/community')}
            />
          </View>
        </View>

        <SectionTitle title="From the stands" />
        <QueryState query={feed} loading={<LoadingBlock lines={1} />}>
          {(posts, provenance) =>
            posts.length === 0 ? (
              <EmptyState
                icon="images-outline"
                title="No moments yet"
                body="Approved moments from supporters appear here."
              />
            ) : (
              <View style={{ gap: space.md }}>
                <View style={styles.grid}>
                  {posts.map((p) => (
                    <PressableScale
                      key={p.id}
                      onPress={() => router.push(`/fan/${p.id}`)}
                      accessibilityLabel={`${p.caption}. ${p.authorDisplayName ?? 'A supporter'}`}
                      style={styles.tile}
                      pressedScale={0.97}
                    >
                      {isImageKey(p.mediaRef) ? (
                        <ConceptImage
                          imageKey={p.mediaRef}
                          style={StyleSheet.absoluteFill}
                          decorative
                          tag="none"
                        />
                      ) : null}
                      <View style={styles.tileFoot}>
                        {p.provenance.state === 'demo' ? <DemoTag onImage /> : null}
                        <Text variant="caption" numberOfLines={2}>
                          {p.caption}
                        </Text>
                      </View>
                    </PressableScale>
                  ))}
                </View>
                <ProvenanceLine
                  provenance={provenance}
                  maxAgeMs={MAX_AGE_MS.content}
                  sourceLabel="Fan Moments"
                />
              </View>
            )
          }
        </QueryState>

        <SectionTitle title="For the family" />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Card
            onPress={() => router.push('/rewards')}
            accessibilityLabel="Khosi Rewards"
            style={{ flex: 1, gap: space.sm }}
          >
            <Ionicons name="gift-outline" size={24} color={color.accent} />
            <Text variant="headline">Khosi Rewards</Text>
            <Text variant="footnote" color="textSecondary">
              Catalogue and terms
            </Text>
          </Card>
          <Card
            onPress={() => router.push('/shop')}
            accessibilityLabel="Official shop"
            style={{ flex: 1, gap: space.sm, padding: 0 }}
            padded={false}
          >
            <ConceptImage imageKey="merchandise" style={{ height: 84 }} decorative tag="none" />
            <View style={{ padding: space.md, gap: 2 }}>
              <Text variant="headline">Shop</Text>
              <Text variant="footnote" color="textSecondary">
                Official store
              </Text>
            </View>
          </Card>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    width: '48.8%',
    aspectRatio: 0.8,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surface,
    justifyContent: 'flex-end',
  },
  tileFoot: { padding: space.sm, gap: space.xs, backgroundColor: 'rgba(16,16,16,0.55)' },
});
