import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Header, InlineNotice, Screen, Text } from '@/components/ui';
import { LEGAL, type LegalDocId } from '@/content/legal';
import { formatDateLong } from '@/domain/shared/format';
import { spacing } from '@/theme';

/** Privacy notice, terms and marketing consent (§19, §38). */
export default function LegalPage() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const page = LEGAL[doc as LegalDocId];
  if (!page) {
    return (
      <Screen header={<Header title="Legal" />}>
        <EmptyState icon="file-text" title="We could not find that page" />
      </Screen>
    );
  }
  return (
    <Screen header={<Header title={page.title} />}>
      {!page.reviewed ? (
        <InlineNotice tone="warning" style={{ marginTop: spacing.lg }}>
          Draft for Mábu’s legal review. Not yet the final wording.
        </InlineNotice>
      ) : null}
      <Text variant="h1" accessibilityRole="header" style={{ marginTop: spacing.xl }}>
        {page.title}
      </Text>
      <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.xs }}>
        Updated {formatDateLong(`${page.updated}T12:00:00+02:00`)}
      </Text>
      {page.sections.map((s) => (
        <View key={s.heading} style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Text variant="h3" accessibilityRole="header">
            {s.heading}
          </Text>
          <Text variant="body" color="textMuted" selectable>
            {s.body}
          </Text>
        </View>
      ))}
    </Screen>
  );
}
