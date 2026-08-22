import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useNetworkStatus } from '@/features/system/useNetworkStatus';
import { colors, spacing } from '@/theme';

/**
 * Persistent offline notice (brief §12).
 *
 * Sits above everything, below the status bar. It slides rather than appearing
 * instantly so a brief tunnel drop does not feel like a UI glitch, and it says
 * what still works — browsing a cached menu and building a cart both do, since
 * the cart is persisted locally. Only checkout genuinely needs the network.
 */
export function OfflineBanner() {
  const { isOffline } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  // Lazy state initialiser rather than a ref: the value must be created once
  // and is read during render, which a ref is not allowed to be.
  const [translateY] = useState(() => new Animated.Value(-120));

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOffline ? 0 : -120,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isOffline, translateY]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLabel={isOffline ? 'You are offline' : ''}
      style={[
        styles.banner,
        { paddingTop: insets.top + spacing.sm, transform: [{ translateY }] },
      ]}
      testID="offline-banner"
    >
      <Ionicons name="cloud-offline-outline" size={16} color={colors.textOnDark} />
      <Text variant="captionMedium" color={colors.textOnDark} style={styles.label}>
        You&apos;re offline — browse and build your cart, checkout needs a connection
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm + 2,
    backgroundColor: colors.brand.black,
  },
  label: { flex: 1 },
});
