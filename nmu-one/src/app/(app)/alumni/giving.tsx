import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { asPhotoKey } from '@/content/photos';
import { formatMoney } from '@/core/domain/money';
import { useCampaigns } from '@/data/hooks';
import { Card, Header, Photo, ProgressBar, QueryState, Screen, Text, colors, radius, spacing } from '@/design';

/** Giving (brief §14, §26 step 14): where a gift goes, and what it does. */
export default function Giving() {
  const router = useRouter();
  const campaigns = useCampaigns();
  return (
    <Screen header={<Header title="Giving" largeTitle="Give where it matters" eyebrow="Alumni" subtitle="Small, regular gifts keep students in their seats." />} testID="giving">
      <QueryState query={campaigns} what="giving campaigns">
        {(list) => (
          <View style={{ gap: spacing.lg }}>
            {list.map((c) => {
              const pct = c.raised.cents / c.goal.cents;
              return (
                <Card key={c.id} padded={false} onPress={() => router.push(`/alumni/give/${c.id}`)} accessibilityLabel={`${c.title}. ${c.summary} ${Math.round(pct * 100)} percent funded.`} testID={`campaign-${c.id}`}>
                  <Photo photo={asPhotoKey(c.photo, 'alumniGiving')} size="md" rounded={false} style={styles.photo} decorative />
                  <View style={styles.body}>
                    <Text variant="title3">{c.title}</Text>
                    <Text variant="body" color={colors.textSecondary}>
                      {c.summary}
                    </Text>
                    <ProgressBar value={pct} tone="yellow" label={`${Math.round(pct * 100)}% funded`} />
                    <Text variant="captionStrong">
                      {formatMoney(c.raised, { showCents: false })} raised of {formatMoney(c.goal, { showCents: false })} · {c.donors.toLocaleString('en-ZA')} donors
                    </Text>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { height: 160, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  body: { padding: spacing.lg, gap: spacing.sm },
});
