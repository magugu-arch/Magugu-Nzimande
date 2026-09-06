import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { SUPPORT } from '@/constants/config';
import { colors, radius, spacing } from '@/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PERSISTED_KEYS } from '@/store/persistence';
import { reportError } from '@/ux/errorReporting';

interface Props {
  children: ReactNode;
  /** Hook for a crash reporter (Sentry, Crashlytics). */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
  /**
   * How many times "Try again" has been pressed on this crash.
   *
   * A crash caused by something transient clears on the first press. A crash
   * caused by a stored value does not: the retry re-renders the same tree,
   * which re-reads the same value, and lands back here. Counting the presses
   * is how the screen tells one from the other without knowing anything about
   * either.
   */
  retries: number;
  /** True while the saved-data reset is running, so the button cannot double-fire. */
  clearing: boolean;
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
  override state: State = { error: null, retries: 0, clearing: false };

  static getDerivedStateFromError(error: Error): Pick<State, 'error'> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    /**
     * `reportError` scrubs before it reports, and it also owns the development
     * logging that used to be a bare `console.error` here.
     *
     * That console line was the leak. A render crash inside checkout carries
     * props down its component stack, and the message on an API error is
     * whatever the server put there — so this printed addresses, emails and
     * the occasional bearer token straight to a log that a crash reporter,
     * once wired, would have shipped verbatim. §13 asks for operational errors
     * "without leaking sensitive customer information"; one shared path makes
     * that true of every caller rather than of whoever remembered.
     */
    reportError(error, { scope: 'render', componentStack: info.componentStack ?? undefined });
    this.props.onError?.(error, info);
  }

  private readonly handleReset = (): void => {
    this.setState((previous) => ({ error: null, retries: previous.retries + 1 }));
  };

  /**
   * The way out of a crash that retrying cannot fix.
   *
   * Driven in Chromium: seed `bbq.cart` with `lines: null`, or a line written
   * without `selectedOptions`, or `bbq.fulfilment` with a branch record that
   * predates `openingHours`, and the app crashes on the first render. This
   * screen caught all three — and then said "Your cart is saved, so nothing is
   * lost" and offered a Try again that re-read the same value and crashed
   * again. There was no way out of that from inside the app. A customer would
   * have had to delete it and start over.
   *
   * `store/persistence` now validates every persisted slice on the way in, so
   * those three cannot happen again. This is for the fourth one — the shape
   * nobody anticipated, which is the only kind that ever gets through.
   *
   * Offered rather than done automatically, and only after a retry has already
   * failed: wiping somebody's basket is not a thing to do behind their back on
   * the strength of one thrown error.
   */
  private readonly handleClearSavedData = (): void => {
    if (this.state.clearing) return;
    this.setState({ clearing: true });

    void AsyncStorage.multiRemove([...PERSISTED_KEYS])
      .catch((cause: unknown) => {
        // Nothing else to try, and the customer is already on the failure
        // screen — but it must be reported rather than swallowed, because a
        // storage layer refusing to delete is the shape of a much worse
        // problem than the crash that led here.
        reportError(cause instanceof Error ? cause : new Error(String(cause)), {
          scope: 'render',
        });
      })
      .finally(() => {
        this.setState({ error: null, retries: 0, clearing: false });
      });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    // One failed retry is the signal. A transient crash clears on the first
    // press; one caused by a stored value comes straight back.
    const retriedAlready = this.state.retries > 0;

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
            {retriedAlready
              ? 'That did not clear it, which usually means something saved on this phone is the problem. Starting fresh clears your basket and saved choices — your account and your order history are not touched.'
              : 'Sorry — the app hit a problem it could not recover from on its own. Nothing has been ordered.'}
          </Text>

          <Button label="Try again" onPress={this.handleReset} size="lg" testID="error-retry" />

          {/*
            Only after a retry has failed. The first press is free and usually
            works; offering to wipe somebody's basket before they have even
            tried is a worse first impression than the crash.
          */}
          {retriedAlready ? (
            <Button
              label={this.state.clearing ? 'Starting fresh…' : 'Start fresh'}
              onPress={this.handleClearSavedData}
              variant="text"
              size="lg"
              disabled={this.state.clearing}
              testID="error-clear-storage"
            />
          ) : null}

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
