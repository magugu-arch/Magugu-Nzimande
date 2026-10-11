import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { STAGE_LABEL } from '@/domain/delivery';
import { STAGES, type TrackingEvent } from '@/domain/types';
import { Tag } from '../Tag';
import { Text } from '../Text';

/**
 * All seven stages, with only the confirmed ones marked done and timestamped.
 * Each confirmed stage says who confirmed it: MAXHOSA for fulfilment, the
 * courier for scans.
 */
export function DeliveryStatusTimeline({
  events,
  stage,
  formatTime,
}: {
  events: TrackingEvent[];
  stage: number;
  formatTime: (iso: string) => string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.list} accessibilityRole="list">
      {STAGES.map((s, i) => {
        const ev = events.filter((e) => e.stage === s).pop();
        const done = i <= stage;
        const current = i === stage;
        return (
          <View
            key={s}
            style={styles.item}
            accessible
            accessibilityLabel={`${STAGE_LABEL[s]}: ${done && ev ? `${ev.description} ${formatTime(ev.at)}` : 'not yet'}`}
          >
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  done
                    ? { backgroundColor: current ? colors.ochre : colors.ink }
                    : {
                        borderWidth: 2,
                        borderColor: colors.hairlineStrong,
                        backgroundColor: colors.card,
                      },
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={13} color={current ? '#FFFCF7' : colors.onInk} />
                ) : null}
              </View>
              {i < STAGES.length - 1 ? (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: i < stage ? colors.ink : colors.hairlineStrong },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text variant="callout" weight="600" color={done ? 'ink' : 'ink3'}>
                  {STAGE_LABEL[s]}
                </Text>
                {done && ev ? (
                  <Tag
                    label={ev.source === 'carrier' ? 'Courier' : 'MAXHOSA'}
                    tone={ev.source === 'carrier' ? 'info' : 'neutral'}
                  />
                ) : null}
              </View>
              {done && ev ? (
                <Text variant="footnote" color="ink2">
                  {ev.description}
                </Text>
              ) : null}
              <Text variant="caption" color="ink3" style={{ fontVariant: ['tabular-nums'] }}>
                {done && ev ? formatTime(ev.at) : 'Not yet'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.gutter },
  item: { flexDirection: 'row', gap: space.m },
  rail: { alignItems: 'center', width: 24 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, minHeight: 18, marginVertical: 2 },
  body: { flex: 1, paddingBottom: space.l, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.s, flexWrap: 'wrap' },
});
