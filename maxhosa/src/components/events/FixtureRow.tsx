import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { AssetImage } from '@/components/AssetImage';
import { PressableScale } from '@/components/PressableScale';
import { Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { EVENT_TIME_ZONE } from '@/domain/events';
import type { BrandEvent, Rsvp } from '@/domain/types';
import { useMarket } from '@/features/catalogue';
import { eventStatus, rsvpLabel, useEventDate, type EventTone } from '@/features/events';

/** One fixture in a list: the date block, what and where, and its state in words. */
export function FixtureRow({
  event,
  rsvp,
  now,
  first,
  thumb,
}: {
  event: BrandEvent;
  rsvp?: Rsvp;
  now: Date;
  first?: boolean;
  thumb?: boolean;
}) {
  const { colors } = useTheme();
  const market = useMarket();
  const dateLabel = useEventDate();
  const start = new Date(event.startsAt);
  const part = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(market.locale, { ...o, timeZone: EVENT_TIME_ZONE }).format(start);
  const status: { label: string; tone: EventTone; icon?: ReturnType<typeof eventStatus>['icon'] } =
    rsvp ? rsvpLabel(rsvp) : eventStatus(event, now);
  return (
    <View>
      {!first ? <View style={[styles.divider, { backgroundColor: colors.hairline }]} /> : null}
      <PressableScale
        pressedScale={0.99}
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${dateLabel(event)}, ${event.city}, ${status.label}${
          event.sample ? ', sample event' : ''
        }`}
        onPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
      >
        <View style={styles.row}>
          <View style={[styles.date, { backgroundColor: colors.sunk }]}>
            <Text variant="caption" weight="700" color="ink3">
              {part({ weekday: 'short' }).toUpperCase()}
            </Text>
            <Text variant="title" style={styles.day}>
              {part({ day: 'numeric' })}
            </Text>
            <Text variant="caption" weight="700" color="ink3">
              {part({ month: 'short' }).toUpperCase()}
            </Text>
          </View>
          {thumb ? (
            <AssetImage assetId={event.heroAssetId} decorative style={styles.thumb} />
          ) : null}
          <View style={styles.main}>
            <Text variant="caption" color="ink3">
              {event.kindLabel} · {event.city}
            </Text>
            <Text variant="callout" weight="600">
              {event.title}
            </Text>
            <Tag label={status.label} tone={status.tone} icon={status.icon} />
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.m,
    paddingVertical: space.m,
    minHeight: 72,
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
  date: {
    width: 46,
    paddingVertical: space.xs,
    borderRadius: radius.s,
    alignItems: 'center',
  },
  day: { lineHeight: 26 },
  thumb: { width: 52, height: 52, borderRadius: radius.s },
  main: { flex: 1, gap: 3 },
});
