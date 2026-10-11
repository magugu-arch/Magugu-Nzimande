import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { nextEventFor } from '@/domain/events';
import { useEvents, useEventDate } from '@/features/events';

/** On a product page: the next fixture whose edit includes this piece. */
export function WearItTo({ productId }: { productId: string }) {
  const { colors } = useTheme();
  const data = useEvents();
  const dateLabel = useEventDate();
  const e = data.data ? nextEventFor(productId, data.data.list, data.data.now) : undefined;
  if (!e) return null;
  return (
    <PressableScale
      pressedScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={`Wear it to ${e.title}, ${dateLabel(e)}, ${e.city}${e.sample ? ', sample event' : ''}`}
      onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })}
      style={[styles.box, { backgroundColor: colors.ochreSoft }]}
    >
      <View style={[styles.icon, { backgroundColor: colors.card }]}>
        <Ionicons name="calendar-outline" size={17} color={colors.ink} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="callout" weight="600">
          Wear it to {e.title}
        </Text>
        <Text variant="footnote" color="ink2">
          {dateLabel(e)} · {e.city}
          {e.sample ? ' · sample event' : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.ink2} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    borderRadius: radius.m,
    marginTop: space.l,
  },
  icon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
