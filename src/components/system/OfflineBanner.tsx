import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/ui/Text';
import { useNetworkStatus } from '@/features/system/useNetworkStatus';
import { useReduceMotion } from '@/features/system/useReduceMotion';
import { colors, spacing } from '@/theme';
import { announce } from '@/utils/accessibility';

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
  const reduceMotion = useReduceMotion();

  // Lazy state initialiser rather than a ref: the value is created once and
  // read during render, which a ref is not allowed to be.
  const [height] = useState(() => new Animated.Value(0));
  const measured = useRef(0);

  useEffect(() => {
    Animated.timing(height, {
      toValue: isOffline ? measured.current : 0,
      // The slide is the point of the animation, so under Reduce Motion the
      // bar simply appears rather than sliding in slower.
      duration: reduceMotion ? 0 : 220,
      useNativeDriver: false,
    }).start();
  }, [isOffline, height, reduceMotion]);

  const announcedFor = useRef<boolean | null>(null);

  useEffect(() => {
    // Losing the connection is not something the customer did, so nothing else
    // would tell them. `accessibilityRole="alert"` covers a bar already present
    // when a screen mounts; this covers one that arrives while they are reading.
    //
    // Only on a change, never on the first run — otherwise every launch opens
    // with "Back online", which is both untrue and startling.
    if (announcedFor.current === null) {
      announcedFor.current = isOffline;
      return;
    }
    if (announcedFor.current === isOffline) return;
    announcedFor.current = isOffline;

    announce(
      isOffline ? "You're offline. You can still browse and build your cart." : 'Back online.',
    );
  }, [isOffline]);

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
      {/*
        Rendered only while it applies, rather than kept at zero height.

        The clip container collapses to 0 and hides the bar visually, and that
        was taken to be enough. It is not: the sentence stayed in the tree on
        every screen of a perfectly online app, inside a `View` marked
        `accessibilityRole="alert"`. A screen reader is entitled to announce an
        alert it finds, and "You're offline — browse and build your cart" is a
        poor thing to hear while online.

        It also made the bar impossible to test honestly. `audit:offline` looked
        for the element and found it every time, so its new recovery check
        reported a working build as offline — and the same string had been
        turning up in the text of every browser probe in this repository,
        reading like a defect that was not there. A control that is invisible
        but present is one that lies to a screen reader and to a test in the
        same breath.

        The cost is one frame on the very first drop: with nothing mounted there
        is nothing measured, so `onMeasure` snaps the height rather than sliding
        it. Every subsequent transition animates. That is the right way round —
        the first time somebody loses signal is when they most want to be told
        immediately.
      */}
      {isOffline ? (
        <View
          onLayout={onMeasure}
          style={[styles.banner, { paddingBottom: insets.bottom + spacing.sm + 2 }]}
          accessibilityRole="alert"
          accessibilityLabel="You are offline"
        >
          <Ionicons name="cloud-offline-outline" size={16} color={colors.textOnDark} />
          <Text variant="captionMedium" color={colors.textOnDark} style={styles.label}>
            You&apos;re offline — browse and build your cart, checkout needs a connection
          </Text>
        </View>
      ) : null}
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
