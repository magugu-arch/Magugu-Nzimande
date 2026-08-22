import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Store } from '@/types';
import { Text } from '@/components/ui';
import { config } from '@/constants/config';
import { absoluteFill, colors, radius, spacing } from '@/theme';
import { DEFAULT_COORDINATES, type Coordinates } from '@/utils/geo';

export interface StoreMapPreviewProps {
  stores: Store[];
  origin?: Coordinates | null;
  selectedStoreId?: string | undefined;
  onSelectStore: (store: Store) => void;
  height?: number;
}

/**
 * Store map.
 *
 * Renders a schematic, correctly-scaled plot of nearby stores relative to the
 * customer using pure React Native — no native map SDK, so it works in Expo Go,
 * in tests and without an API key. `config.maps` is the swap point: drop in
 * react-native-maps or Mapbox here and every caller stays unchanged, because
 * the props (stores, origin, selection) are already the ones a real map needs.
 */
export const StoreMapPreview = memo(function StoreMapPreview({
  stores,
  origin,
  selectedStoreId,
  onSelectStore,
  height = 180,
}: StoreMapPreviewProps) {
  const centre = origin ?? DEFAULT_COORDINATES;

  /**
   * Project lat/lng into the box. We scale by the furthest store so the
   * plot always fills the frame regardless of how spread out the network is.
   */
  const points = useMemo(() => {
    if (stores.length === 0) return [];

    const deltas = stores.map((store) => ({
      store,
      dx: store.longitude - centre.longitude,
      dy: store.latitude - centre.latitude,
    }));

    const maxSpread = Math.max(
      0.01,
      ...deltas.map((delta) => Math.max(Math.abs(delta.dx), Math.abs(delta.dy))),
    );

    return deltas.map(({ store, dx, dy }) => ({
      store,
      // 0.5 is the customer's position; 0.4 keeps pins inside the frame.
      left: 0.5 + (dx / maxSpread) * 0.4,
      // Latitude increases northward, screen y increases downward.
      top: 0.5 - (dy / maxSpread) * 0.4,
    }));
  }, [stores, centre]);

  return (
    <View style={[styles.container, { height }]} accessibilityLabel="Map of nearby bb.q stores">
      {/* Grid backdrop */}
      <View style={styles.grid} pointerEvents="none">
        {Array.from({ length: 5 }, (_, index) => (
          <View key={`h-${index}`} style={[styles.gridLine, { top: `${(index + 1) * 16.6}%` }]} />
        ))}
        {Array.from({ length: 5 }, (_, index) => (
          <View
            key={`v-${index}`}
            style={[styles.gridLineVertical, { left: `${(index + 1) * 16.6}%` }]}
          />
        ))}
      </View>

      {/* Customer position */}
      <View style={styles.you} pointerEvents="none">
        <View style={styles.youPulse} />
        <View style={styles.youDot} />
      </View>

      {/* Store pins */}
      {points.map(({ store, left, top }) => {
        const selected = store.id === selectedStoreId;
        return (
          <Pressable
            key={store.id}
            onPress={() => onSelectStore(store)}
            accessibilityRole="button"
            accessibilityLabel={`${store.name}, ${store.distanceKm} kilometres away`}
            accessibilityState={{ selected }}
            style={[
              styles.pin,
              { left: `${left * 100}%`, top: `${top * 100}%` },
              selected ? styles.pinSelected : null,
            ]}
          >
            <Ionicons
              name="location"
              size={selected ? 20 : 16}
              color={selected ? colors.onPrimary : colors.primary}
            />
          </Pressable>
        );
      })}

      {config.maps.apiKey.length === 0 ? (
        <View style={styles.notice} pointerEvents="none">
          <Text variant="micro" color={colors.textOnDarkMuted}>
            SCHEMATIC VIEW
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.brand.black,
  },
  grid: { ...absoluteFill },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  you: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -14,
    marginTop: -14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youPulse: {
    ...absoluteFill,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  youDot: {
    width: 11,
    height: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral.white,
  },
  pin: {
    position: 'absolute',
    marginLeft: -16,
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.white,
  },
  pinSelected: { backgroundColor: colors.primary, transform: [{ scale: 1.15 }] },
  notice: { position: 'absolute', right: spacing.sm, bottom: spacing.sm },
});
