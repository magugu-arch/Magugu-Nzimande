import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { trackingView } from '@/domain/delivery';
import { useOrders } from '@/features/catalogue';
import { useTimeFormat } from '@/features/time';
import { useTracking } from '@/features/tracking';
import { PressableScale } from '../PressableScale';
import { Text } from '../Text';
import { StageBar } from './StatusCard';

/** The order in progress, glanceable from Home — the in-app counterpart of a Live Activity. */
export function LiveOrderCard() {
  const orders = useOrders();
  const { retry } = orders;
  useFocusEffect(useCallback(() => retry(), [retry]));
  const latest = orders.data?.[0];
  const { tracking } = useTracking(latest?.id);
  const formatTime = useTimeFormat();
  const { colors } = useTheme();
  if (!latest || !tracking) return null;
  const view = trackingView(tracking, formatTime);
  if (view.stage === 6) return null;
  return (
    <View style={styles.wrap}>
      <PressableScale
        pressedScale={0.98}
        accessibilityRole="button"
        accessibilityLabel={`Order ${latest.id}, simulated. ${view.title}. ${view.estimate.text}`}
        onPress={() => router.push({ pathname: '/orders/[id]', params: { id: latest.id } })}
        style={[styles.card, { backgroundColor: colors.ink }]}
      >
        <Text variant="eyebrow" style={{ color: colors.onInk, opacity: 0.72 }}>
          {latest.id} · simulated
        </Text>
        <Text variant="heading" style={{ color: colors.onInk, marginTop: space.xs }}>
          {view.title}
        </Text>
        <Text variant="footnote" style={{ color: colors.onInk, opacity: 0.86 }}>
          {view.estimate.text}
        </Text>
        <StageBar stage={view.stage} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.gutter, paddingTop: space.xl },
  card: { padding: space.l + 2, borderRadius: radius.l },
});
