import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { EventCard } from '@/components/mabu/Cards';
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  Photo,
  Screen,
  SectionTitle,
  Text,
} from '@/components/ui';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { colors, radius, spacing } from '@/theme';

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
      <Pressable
        onPress={() => router.push('/private-functions')}
        accessibilityRole="button"
        accessibilityLabel="Private functions. Private dining, corporate events, celebrations, weddings and exclusive venue hire. Enquire."
        style={({ pressed }) => [styles.functions, pressed && { opacity: 0.85 }]}
      >
        <Photo photo="hero-events" label="" style={StyleSheet.absoluteFill} scrim="bottom" />
        <View style={{ padding: spacing.lg, gap: spacing.xs }}>
          <Text variant="eyebrow" color="accent" style={{ letterSpacing: 3 }}>
            Unforgettable
          </Text>
          <Text variant="h1">Events</Text>
          <Text variant="bodySmall" color="textMuted">
            Private dining · corporate · celebrations · weddings · venue hire
          </Text>
          <Text variant="button" color="accent" style={{ marginTop: spacing.sm }}>
            Enquire →
          </Text>
        </View>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  functions: {
    height: 260,
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: spacing.xl,
  },
});
