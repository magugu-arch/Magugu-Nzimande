import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useDialogStore } from '@/ux/dialog';
import { colors, elevation, radius, spacing } from '@/theme';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

/**
 * The one dialog the whole app asks through. Mounted once, at the root.
 *
 * `Modal` is used rather than an absolutely-positioned view because
 * react-native-web implements it properly — a portal, a focus trap and an
 * Escape handler — which is exactly the accessibility work that would
 * otherwise have to be redone here and got wrong. (`Alert` is the export that
 * is a stub; see `ux/dialog.ts`.)
 *
 * Only the front of the queue is drawn. Two things asking at once is not
 * hypothetical: cancelling an order opens a confirmation whose failure path
 * opens a second dialog, and losing the second one would leave the customer
 * believing the cancellation worked.
 */
export function DialogHost() {
  const pending = useDialogStore((state) => state.queue[0]);
  const answer = useDialogStore((state) => state.answer);

  if (!pending) return null;

  const { id, title, message, confirmLabel, cancelLabel, destructive } = pending;
  // No affirmative label means there is nothing to decide — a notice. It gets
  // one button, and dismissing it is the same as reading it.
  const isNotice = confirmLabel === undefined;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      // Android back and, on web, the Escape key. Both mean "no".
      onRequestClose={() => answer(id, false)}
      accessibilityViewIsModal
    >
      <Pressable
        style={styles.scrim}
        // Tapping the scrim is a dismissal, not an answer — so it resolves
        // false even where the affirmative is the friendly option.
        onPress={() => answer(id, false)}
        /*
          Out of the tab order, and no longer announced as a control.

          The scrim is a pointer convenience: tap outside to dismiss. It was
          also a focusable button called "Dismiss", and because it comes first
          in the modal it was the first thing a keyboard or screen-reader user
          met — an offer to close the question, announced before the question.
          Driven in Chromium, the tab cycle opened: Dismiss → title → Empty
          cart → Keep it.

          Nothing is lost by taking it out. Escape dismisses, `Keep it` is the
          same answer said properly, and both are inside the card where somebody
          looking for a way out will find them.

          `focusable` and the role only — deliberately **not** `aria-hidden` or
          `importantForAccessibility="no"`. The first attempt used those and the
          dialog's own tests failed instantly: this element wraps the card, and
          both of those are inherited, so hiding the scrim hid the question
          inside it from the accessibility tree as well. A scrim that is not a
          control is the goal; a dialog nobody can hear is not.
        */
        focusable={false}
        testID="dialog-scrim"
      >
        {/* Swallows taps so a press inside the card never reaches the scrim. */}
        <Pressable
          style={styles.card}
          accessibilityRole="alert"
          accessibilityLabel={message ? `${title}. ${message}` : title}
          testID="dialog"
          onPress={() => {}}
        >
          <Text variant="h2" testID="dialog-title">
            {title}
          </Text>

          {message ? (
            <Text variant="body" color={colors.textSecondary} style={styles.message}>
              {message}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {isNotice ? (
              <Button
                label={cancelLabel ?? 'OK'}
                onPress={() => answer(id, true)}
                fullWidth
                testID="dialog-confirm"
              />
            ) : (
              <>
                <Button
                  label={confirmLabel}
                  onPress={() => answer(id, true)}
                  fullWidth
                  preserveCase
                  // The destructive action wears §8's error red rather than
                  // brand red, so "Delete account" cannot be mistaken for the
                  // ordinary primary action it sits one tap away from.
                  style={destructive ? styles.destructive : undefined}
                  testID="dialog-confirm"
                />
                <Button
                  label={cancelLabel ?? 'Cancel'}
                  onPress={() => answer(id, false)}
                  variant="text"
                  fullWidth
                  preserveCase
                  testID="dialog-cancel"
                />
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(34,30,31,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    ...elevation.lg,
  },
  message: {
    marginTop: spacing.xs,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  destructive: {
    backgroundColor: colors.status.error,
    borderColor: colors.status.error,
  },
});
