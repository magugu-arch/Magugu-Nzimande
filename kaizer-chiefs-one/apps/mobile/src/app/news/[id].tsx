import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MAX_AGE_MS } from '@kc-one/contracts';
import {
  BackHeader,
  Column,
  GlassButton,
  ConceptImage,
  Eyebrow,
  ProvenanceLine,
  QueryState,
  Screen,
  Text,
} from '@/components';
import { isImageKey } from '@/config/imagery';
import { useArticle } from '@/data/queries';
import { usePreferences } from '@/state/preferences';
import { space } from '@/theme';

/** Long-form story. Body copy sits at a comfortable measure and leading. */
export default function Article() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useArticle(id);
  const { height } = useWindowDimensions();
  const saved = usePreferences((s) => s.savedIds.includes(id));
  const toggleSaved = usePreferences((s) => s.toggleSaved);
  return (
    <View style={{ flex: 1 }}>
      <Screen edgeToEdge>
        <QueryState
          query={q}
          loading={
            <Column style={{ paddingTop: 120 }}>
              <Text variant="body">Loading…</Text>
            </Column>
          }
        >
          {(item) => (
            <>
              <View style={{ height: Math.min(height * 0.5, 460) }}>
                {isImageKey(item.heroImageKey) ? (
                  <ConceptImage
                    imageKey={item.heroImageKey}
                    style={StyleSheet.absoluteFill}
                    fade="bottom"
                    tag="hero"
                    parallax
                  />
                ) : null}
              </View>
              <Column style={{ gap: space.lg, marginTop: -space.xl }}>
                {item.eyebrow ? <Eyebrow>{item.eyebrow}</Eyebrow> : null}
                <Text variant="title1" accessibilityRole="header">
                  {item.title}
                </Text>
                <Text
                  variant="title3"
                  color="textSecondary"
                  style={{ fontFamily: 'Inter_400Regular' }}
                >
                  {item.summary}
                </Text>
                <ProvenanceLine
                  provenance={item.provenance}
                  maxAgeMs={MAX_AGE_MS.content}
                  sourceLabel="Club content"
                />
                <View style={{ gap: space.lg, marginTop: space.md }}>
                  {item.body.map((p, i) => (
                    <Text key={i} variant="body" style={{ fontSize: 17, lineHeight: 28 }}>
                      {p}
                    </Text>
                  ))}
                </View>
              </Column>
            </>
          )}
        </QueryState>
      </Screen>
      <BackHeader
        overlay
        right={
          <GlassButton
            icon={saved ? 'bookmark' : 'bookmark-outline'}
            accessibilityLabel={saved ? 'Remove from saved stories' : 'Save story'}
            onPress={() => toggleSaved(id)}
          />
        }
      />
    </View>
  );
}
