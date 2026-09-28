import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { EventCard } from '@/components/mabu/Cards';
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PremiumButton,
  Screen,
  SectionTitle,
  Text,
} from '@/components/ui';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { colors, spacing } from '@/theme';

/** §11 Events & experiences — a first-class commercial section, not a news feed. */
export default function Events() {
  const q = useRpc('events.list');
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          tintColor={colors.accent}
        />
      }
    >
      <View style={{ marginTop: spacing.xl, gap: spacing.xs }}>
        <Text variant="eyebrow" color="accent">
          Events & experiences
        </Text>
        <Text variant="h1" accessibilityRole="header">
          Evenings to remember
        </Text>
        <Text variant="body" color="textMuted">
          Wine pairings, chef evenings and tasting menus — reserve your place.
        </Text>
      </View>
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
      ) : q.data.length ? (
        <View style={{ gap: spacing.xl, marginTop: spacing.xl }}>
          {q.data.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="calendar"
          title="New experiences are being composed"
          body="Check back soon, or join MÁBU Rewards to hear first."
        />
      )}
      <SectionTitle eyebrow="Private functions" title="Your own occasion" />
      <Text variant="body" color="textMuted">
        From intimate celebrations to long-table feasts, our events team will compose an evening
        around you.
      </Text>
      <PremiumButton
        label="Enquire about private functions"
        variant="secondary"
        style={{ marginTop: spacing.lg }}
        onPress={() => router.push('/private-functions')}
      />
    </Screen>
  );
}
