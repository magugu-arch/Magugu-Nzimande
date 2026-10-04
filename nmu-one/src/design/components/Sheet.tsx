import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../tokens';
import { Text } from './Text';

/**
 * A bottom sheet for decisions that need explicit consent or confirmation —
 * location sharing, payment, graduation. Deliberately not animated beyond the
 * platform default: brief §19 keeps motion out of safety, finance and identity.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View
          testID={testID}
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}
          accessibilityViewIsModal
        >
          <View style={styles.grabber} />
          <Text variant="title2" accessibilityRole="header">
            {title}
          </Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim, alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
});
