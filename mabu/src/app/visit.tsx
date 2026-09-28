import { View } from 'react-native';
import { ContactActions, DirectionsCard } from '@/components/mabu/Cards';
import {
  Card,
  ErrorState,
  Header,
  LoadingBlock,
  Screen,
  SectionTitle,
  Text,
} from '@/components/ui';
import { venueDate, venueWeekday } from '@/domain/shared/time';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { spacing } from '@/theme';

/** §4 Visit: map, directions, parking and access notes, contact, hours. */
export default function Visit() {
  const q = useRpc('content.venue');
  if (q.isPending)
    return (
      <Screen header={<Header title="Visit" />}>
        <LoadingBlock />
      </Screen>
    );
  if (q.isError)
    return (
      <Screen header={<Header title="Visit" />}>
        <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
      </Screen>
    );
  const v = q.data;
  const today = venueWeekday(venueDate(new Date()));
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Screen
      meta={{
        title: 'Find Us in Waterfall City, Midrand',
        description:
          'Directions, parking, opening hours and contact details for Mábu at Waterfall Wilds, Waterfall City, Midrand.',
        path: '/visit',
      }}
      header={<Header title="Visit" />}
    >
      <Text variant="h1" style={{ marginTop: spacing.md }} accessibilityRole="header">
        Find your way to Mábu
      </Text>
      <Text variant="body" color="textMuted" style={{ marginTop: spacing.sm }}>
        {v.area}
      </Text>
      <View style={{ marginTop: spacing.xl }}>
        <DirectionsCard venue={v} />
      </View>

      <SectionTitle eyebrow="Opening hours" title="When we are open" />
      <Card style={{ gap: spacing.sm }}>
        {order.map((d) => {
          const h = v.hours.find((x) => x.day === d);
          if (!h) return null;
          return (
            <View
              key={d}
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}
              accessible
              accessibilityLabel={`${h.label}: ${h.hours ?? 'closed'}${d === today ? ', today' : ''}`}
            >
              <Text variant="body" color={d === today ? 'accent' : 'text'}>
                {h.label}
              </Text>
              <Text
                variant="body"
                color={h.hours ? (d === today ? 'accent' : 'text') : 'textSubtle'}
              >
                {h.hours ?? 'Closed'}
              </Text>
            </View>
          );
        })}
        {v.isSample ? (
          <Text variant="caption" color="textSubtle">
            Hours shown for preview; to be confirmed by Mábu.
          </Text>
        ) : null}
      </Card>

      <SectionTitle eyebrow="Arriving" title="Parking & access" />
      <View style={{ gap: spacing.sm }}>
        {v.arrivalNotes.map((n) => (
          <Text key={n} variant="body" color="textMuted">
            · {n}
          </Text>
        ))}
      </View>

      <SectionTitle eyebrow="Get in touch" title="Reservations team" />
      <ContactActions venue={v} />
      <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.md }} selectable>
        {v.email}
      </Text>
    </Screen>
  );
}
