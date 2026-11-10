import { View } from 'react-native';
import { FEATURES, FEATURE_COPY } from '@kc-one/contracts';
import { tokenSource } from '@kc-one/ui';
import { BackHeader, Group, ListRow, Screen, Text } from '@/components';
import { appEnv, appVersion, capabilities } from '@/config/env';
import { space } from '@/theme';

const MODE_COPY = { off: 'Not connected', demo: 'Demo content', live: 'Connected' } as const;

/** Version, environment and an honest list of what is connected. */
export default function About() {
  return (
    <Screen topInset={false} header={<BackHeader title="About this app" />}>
      <View style={{ gap: space.xl }}>
        <Group>
          <ListRow title="Version" value={appVersion} />
          <ListRow title="Environment" value={appEnv} />
        </Group>
        <Text variant="eyebrow" color="textTertiary">
          Data sources
        </Text>
        <Group>
          {FEATURES.map((f) => (
            <ListRow key={f} title={FEATURE_COPY[f]} value={MODE_COPY[capabilities[f]]} />
          ))}
        </Group>
        <Text variant="eyebrow" color="textTertiary">
          Status of this build
        </Text>
        <Text variant="callout" color="textSecondary">
          A proposed product and visual direction for the Kaizer Chiefs One App. Not an official
          Kaizer Chiefs product and not approved by the club.
        </Text>
        <Text variant="callout" color="textSecondary">
          Colours and type: {tokenSource.note}
        </Text>
        <Text variant="callout" color="textSecondary">
          Images marked CONCEPT IMAGE are generated reference images, not club photography. The
          crest appears only as a placeholder until the club supplies its approved artwork.
        </Text>
        <Text variant="footnote" color="textTertiary">
          Typefaces: Barlow Condensed, Inter and DM Mono, under the SIL Open Font License 1.1.
        </Text>
      </View>
    </Screen>
  );
}
