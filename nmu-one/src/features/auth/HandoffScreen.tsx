import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BrandMark, Button, Notice, Text, colors, spacing } from '@/design';

/**
 * What a person sees for the moment between another service (NMU SSO, the
 * payment provider) handing them back and the app taking over: the same
 * navy as the sign-in screen, so the return reads as one journey.
 */
export function HandoffScreen({
  message,
  problem,
  onBack,
  backLabel = 'Back to sign-in',
  testID,
}: {
  message: string;
  problem?: string | null;
  onBack?: () => void;
  backLabel?: string;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom }]}
      testID={testID}
    >
      <StatusBar style="light" />
      <BrandMark tone="onDark" size="sm" />
      <View style={styles.body}>
        {problem ? (
          <>
            <Notice tone="danger" title="That didn’t complete" body={problem} />
            {onBack ? (
              <Button label={backLabel} variant="accent" fullWidth onPress={onBack} />
            ) : null}
          </>
        ) : (
          <View style={styles.waiting} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.yellow} size="large" />
            <Text variant="bodyLarge" color={colors.white} align="center">
              {message}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.gutter,
    gap: spacing.xl,
  },
  body: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  waiting: { alignItems: 'center', gap: spacing.lg },
});
