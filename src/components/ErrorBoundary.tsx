import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { SUPPORT } from '@/constants/config';
import { colors, radius, spacing } from '@/theme';

interface Props {
  children: ReactNode;
  /** Hook for a crash reporter (Sentry, Crashlytics). */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes anywhere below it.
 *
 * Without this a thrown error unmounts the whole tree and the customer is left
 * staring at a white screen with no way back — worst of all mid-checkout. This
 * puts a branded recovery screen up instead, and gives them the store's number,
 * because a customer whose order just vanished wants a person, not a retry.
 *
 * React only routes render/lifecycle errors here. Async rejections inside event
 * handlers still need their own try/catch — the services already normalise
 * those into customer-readable messages.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Wire a crash reporter in here; console keeps it visible in dev.
    console.error('Unhandled render error', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private readonly handleReset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root} testID="error-boundary">
        <ScrollView contentContainerStyle={styles.content}>
          <BrandMark size="sm" />

          <View style={styles.iconWell}>
            <Ionicons name="alert-circle-outline" size={34} color={colors.primary} />
          </View>

          <Text variant="h1" align="center">
            Something broke
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center">
            Sorry — the app hit a problem it could not recover from on its own. Your cart is saved,
            so nothing is lost.
          </Text>

          <Button label="Try again" onPress={this.handleReset} size="lg" testID="error-retry" />

          <View style={styles.support}>
            <Text variant="caption" color={colors.textMuted} align="center">
              If it keeps happening, call us on {SUPPORT.phone} — {SUPPORT.hours}.
            </Text>
          </View>

          {__DEV__ ? (
            <View style={styles.devBox}>
              <Text variant="micro" color={colors.textMuted}>
                DEV ONLY
              </Text>
              <Text variant="caption" color={colors.status.error}>
                {error.message}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  iconWell: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginTop: spacing.lg,
  },
  support: { paddingTop: spacing.sm },
  devBox: {
    alignSelf: 'stretch',
    gap: spacing.xs,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.status.errorSoft,
  },
});
