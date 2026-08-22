import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/ui/Text';
import { useNetworkStatus } from '@/features/system/useNetworkStatus';
import { colors, spacing } from '@/theme';

/**
 * Persistent offline notice (brief §12).
 *
 * It takes space at the foot of the app rather than floating over the top. An
 * earlier version was absolutely positioned at the top, which read fine in
 * isolation and covered every screen's title the moment it appeared — go
 * offline on Menu and the word "Menu" vanished behind it for as long as the
 * drop lasted. A bar that stays for the duration of a state is not a toast, so
 * it belongs in the layout.
 *
 * Below rather than above, for two reasons: it is where a connectivity bar is
 * conventionally found, and a bar at the top would have to clear the status bar
 * itself while every screen is already padding for it, which double-pads the
 * whole app the moment the network drops.
 *
 * The height animates rather than snapping, so a brief tunnel drop reads as a
 * bar arriving instead of the whole screen jumping. That rules out the native
 * driver, which cannot animate layout — acceptable for one bar that moves
 * twice a journey at most.
 *
 * It says what still works: browsing a cached menu and building a cart both
 * do, since the cart is persisted locally. Only checkout needs the network.
 */
export function OfflineBanner() {
  const { isOffline } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  // Lazy state initialiser rather than a ref: the value is created once and
  // read during render, which a ref is not allowed to be.
  const [height] = useState(() => new Animated.Value(0));
  const measured = useRef(0);

  useEffect(() => {
    Animated.timing(height, {
      toValue: isOffline ? measured.current : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isOffline, height]);

  const onMeasure = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    if (next === measured.current) return;
    measured.current = next;
    // A rotation or a font-scale change can re-measure while the bar is
    // already open, so keep it in step rather than stranding it at the old
    // height.
    if (isOffline) height.setValue(next);
  };

  return (
    <Animated.View style={[styles.clip, { height }]} testID="offline-banner">
      <View
        onLayout={onMeasure}
        style={[styles.banner, { paddingBottom: insets.bottom + spacing.sm + 2 }]}
        accessibilityRole="alert"
        accessibilityLabel={isOffline ? 'You are offline' : ''}
      >
        <Ionicons name="cloud-offline-outline" size={16} color={colors.textOnDark} />
        <Text variant="captionMedium" color={colors.textOnDark} style={styles.label}>
          You&apos;re offline — browse and build your cart, checkout needs a connection
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // The inner view is measured at full height regardless of the outer one, so
  // the clip has to hide the overflow while the bar is closed.
  clip: { overflow: 'hidden', backgroundColor: colors.brand.black },
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
    backgroundColor: colors.brand.black,
  },
  label: { flex: 1 },
});
