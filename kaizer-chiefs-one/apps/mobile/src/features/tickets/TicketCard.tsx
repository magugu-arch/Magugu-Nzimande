import { StyleSheet, View } from 'react-native';
import type { TicketSummary } from '@kc-one/contracts';
import { CrestSlot, DemoTag, Pill, PressableScale, Text } from '@/components';
import { color, radius, space } from '@/theme';

const STATUS_TONE = {
  active: 'success',
  used: 'neutral',
  expired: 'neutral',
  transferred: 'outline',
  cancelled: 'danger',
} as const;

export function TicketCard({ ticket, onPress }: { ticket: TicketSummary; onPress?: () => void }) {
  const seat = ticket.seat;
  const cells: [string, string | null | undefined][] = [
    ['Gate', seat?.gate],
    ['Block', seat?.block],
    ['Row', seat?.row],
    ['Seat', seat?.seat],
  ];
  const demo = ticket.provenance.state === 'demo';
  const label = `${ticket.eventName}. ${ticket.status}.${demo ? ' Demo ticket, not valid for entry.' : ''}`;
  const Wrap = onPress ? PressableScale : View;
  return (
    <Wrap
      {...(onPress
        ? { onPress, pressedScale: 0.98, accessibilityHint: 'Opens the ticket' }
        : { accessible: true })}
      accessibilityLabel={label}
      style={styles.card}
    >
      <View style={styles.top}>
        <CrestSlot size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" numberOfLines={2}>
            {ticket.eventName}
          </Text>
          <Text variant="footnote" color="textSecondary">
            {ticket.eventStart
              ? new Date(ticket.eventStart).toLocaleString('en-ZA')
              : 'Date to be confirmed'}
          </Text>
        </View>
        <Pill label={ticket.status} tone={STATUS_TONE[ticket.status]} />
      </View>
      <View style={styles.perf}>
        <View style={[styles.notch, { left: -10 }]} />
        <View style={styles.dash} />
        <View style={[styles.notch, { right: -10 }]} />
      </View>
      <View style={styles.cells}>
        {cells.map(([k, v]) => (
          <View key={k} style={styles.cell}>
            <Text variant="micro" color="textTertiary">
              {k}
            </Text>
            <Text variant="data" style={{ fontSize: 22 }}>
              {v ?? '—'}
            </Text>
          </View>
        ))}
      </View>
      {demo ? (
        <View style={styles.demo}>
          <DemoTag />
          <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
            Not a ticket. Not valid for entry.
          </Text>
        </View>
      ) : null}
    </Wrap>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.lineAccent,
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', gap: space.md, padding: space.lg, alignItems: 'center' },
  perf: { height: 20, justifyContent: 'center' },
  dash: {
    marginHorizontal: space.lg,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.lineStrong,
  },
  notch: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.bg,
  },
  cells: { flexDirection: 'row', paddingHorizontal: space.lg, paddingBottom: space.lg },
  cell: { flex: 1, gap: 2 },
  demo: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },
});
