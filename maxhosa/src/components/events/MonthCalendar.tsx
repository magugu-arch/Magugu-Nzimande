import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { HeaderButton } from '@/components/Screen';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { SPRING, project, springConfig } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { MIN_TOUCH, radius, space } from '@/design/tokens';
import { monthGrid } from '@/domain/events';
import type { BrandEvent } from '@/domain/types';
import { useMarket } from '@/features/catalogue';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Props = {
  year: number;
  month: number;
  todayKey: string;
  selected: string | null;
  byDay: Map<string, BrandEvent[]>;
  now: Date;
  onMonth: (delta: 1 | -1) => void;
  onSelect: (day: string | null) => void;
};

/**
 * A month of fixtures. The grid follows a sideways finger 1:1; on release the
 * velocity is projected forward to choose between turning the page and
 * settling back, and the new month arrives from the side the finger was
 * heading, inheriting its speed. Buttons do the same for anyone not swiping.
 */
export function MonthCalendar({
  year,
  month,
  todayKey,
  selected,
  byDay,
  now,
  onMonth,
  onSelect,
}: Props) {
  const { colors } = useTheme();
  const market = useMarket();
  const reduced = useReducedMotion();
  const { width: screen } = useWindowDimensions();
  const width = screen - space.gutter * 2;
  const x = useSharedValue(0);

  const turn = (delta: 1 | -1) => {
    onMonth(delta);
    if (reduced) return;
    x.set(delta * width * 0.6);
    x.set(withSpring(0, springConfig(SPRING.settle)));
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      x.set(e.translationX);
    })
    .onEnd((e) => {
      const projected = x.get() + project(e.velocityX);
      if (Math.abs(projected) > width / 3) {
        const delta = projected < 0 ? 1 : -1;
        runOnJS(onMonth)(delta);
        x.set(delta * width * 0.6 + x.get() * 0.2);
      }
      x.set(withSpring(0, springConfig(SPRING.settle, e.velocityX)));
    });

  const gridStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    opacity: 1 - Math.min(Math.abs(x.value) / (width * 1.4), 0.6),
  }));

  const title = new Intl.DateTimeFormat(market.locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month, 1)));
  const longDay = (k: string) =>
    new Intl.DateTimeFormat(market.locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${k}T12:00:00Z`));

  const cells = monthGrid(year, month);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
      <View style={styles.head}>
        <HeaderButton icon="chevron-back" label="Previous month" onPress={() => turn(-1)} />
        <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
          {title}
        </Text>
        <HeaderButton icon="chevron-forward" label="Next month" onPress={() => turn(1)} />
      </View>
      <View style={styles.week} importantForAccessibility="no-hide-descendants">
        {WEEKDAYS.map((d) => (
          <Text key={d} variant="caption" weight="700" color="ink3" style={styles.weekday}>
            {d.toUpperCase()}
          </Text>
        ))}
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.clip, gridStyle]}>
          {weeks.map((week, i) => (
            <View key={i} style={styles.weekRow}>
              {week.map((k, j) => {
                if (!k) return <View key={`b${j}`} style={styles.cell} />;
                const evs = byDay.get(k) ?? [];
                const isSelected = selected === k;
                const isToday = k === todayKey;
                return (
                  <PressableScale
                    key={k}
                    pressedScale={0.94}
                    onPress={() => onSelect(isSelected ? null : k)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${longDay(k)}, ${
                      evs.length
                        ? `${evs.length} ${evs.length === 1 ? 'event' : 'events'}`
                        : 'no events'
                    }${isToday ? ', today' : ''}`}
                    style={[styles.cell, isSelected && { backgroundColor: colors.ink }]}
                  >
                    <View
                      style={[
                        styles.num,
                        isToday && !isSelected && { borderColor: colors.ochre, borderWidth: 1.5 },
                      ]}
                    >
                      <Text
                        variant="callout"
                        weight={evs.length ? '700' : '400'}
                        color={isSelected ? 'onInk' : evs.length ? 'ink' : 'ink3'}
                      >
                        {Number(k.slice(8))}
                      </Text>
                    </View>
                    <View style={styles.dots}>
                      {evs.slice(0, 3).map((e) => (
                        <View
                          key={e.id}
                          style={[
                            styles.dot,
                            {
                              backgroundColor: isSelected
                                ? colors.onInk
                                : new Date(e.endsAt) < now
                                  ? colors.ink3
                                  : colors.ochre,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.s,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  week: { flexDirection: 'row', paddingVertical: space.xs },
  weekday: { flex: 1, textAlign: 'center' },
  clip: { gap: 2 },
  weekRow: { flexDirection: 'row' },
  cell: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 2,
  },
  num: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
