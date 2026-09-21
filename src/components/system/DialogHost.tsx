import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { isDismissable, useDialogStore, type DialogButton } from '@/features/system/dialogStore';
import { useReduceMotion } from '@/features/system/useReduceMotion';
import { colors, radius, spacing } from '@/theme';

/**
 * Draws whatever dialog the store is holding. Mounted once, above the
 * navigator, so a dialog outlives the screen that raised it — `useReorder`
 * raises one and then routes to the cart, and the message must survive that.
 *
 * `Modal` is used rather than an absolutely positioned overlay because it is
 * the only primitive that gets the accessibility right on all three
 * platforms: focus moves into the dialog and is trapped there, the content
 * behind it is hidden from screen readers, and Escape and the Android back
 * button both close it. React Native Web implements all of that faithfully —
 * which is the difference between `Modal` and `Alert`, and the reason this
 * component is the fix rather than a workaround.
 */
export function DialogHost() {
  const request = useDialogStore((state) => state.request);
  const resolve = useDialogStore((state) => state.resolve);
  const dismiss = useDialogStore((state) => state.dismiss);
  const reduceMotion = useReduceMotion();
  const { width } = useWindowDimensions();

  if (!request) return null;

  const dismissable = isDismissable(request);

  /*
   * Two short buttons sit side by side; anything else stacks.
   *
   * The threshold is on the *text*, not the count, because "Keep it / Empty
   * cart" fits a row and "Not now / Delete my account permanently" does not.
   * Measuring properly would need a layout pass and a re-render; the
   * character count is the cheap approximation that gets it right for every
   * pair the app actually ships, and stacking is the safe direction to be
   * wrong in — a stacked pair is merely taller, a squeezed row truncates.
   */
  const labels = request.buttons.map(labelFor);
  const inline = request.buttons.length === 2 && labels.join('').length <= 24 && width >= 320;

  return (
    <Modal
      visible
      transparent
      // Under Reduce Motion the dialog appears rather than fading. §13.
      animationType={reduceMotion ? 'none' : 'fade'}
      // Android's back button, and Escape on web. Ignored where there is no
      // cancelling — a destructive confirm with no cancel button would
      // otherwise be dismissable by a key press, which is the opposite of
      // what a confirmation is for.
      onRequestClose={dismissable ? dismiss : undefined}
      statusBarTranslucent
      accessibilityViewIsModal
      testID="app-dialog"
    >
      <View style={styles.scrim}>
        {/*
          The backdrop closes the dialog only where dismissing is allowed, and
          is invisible to screen readers either way: it is a convenience for a
          pointer, and a reader user already has Escape and the buttons.
        */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissable ? dismiss : undefined}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          testID="app-dialog-backdrop"
        />

        <View
          style={styles.card}
          accessibilityRole={Platform.OS === 'web' ? 'none' : undefined}
          testID="app-dialog-card"
        >
          <Text
            variant="h3"
            color={colors.textPrimary}
            style={styles.title}
            testID="app-dialog-title"
          >
            {request.title}
          </Text>

          {request.message ? (
            <Text
              variant="body"
              color={colors.textSecondary}
              style={styles.message}
              testID="app-dialog-message"
            >
              {request.message}
            </Text>
          ) : null}

          <View style={[styles.actions, inline && styles.actionsInline]}>
            {request.buttons.map((button, index) => (
              <Button
                // Index is the identity here: two buttons may legitimately
                // carry the same label, and the list never reorders.
                key={index}
                label={labelFor(button)}
                onPress={() => resolve(index)}
                variant={variantFor(button)}
                size="md"
                fullWidth={!inline}
                preserveCase
                style={inline ? styles.inlineButton : undefined}
                testID={`app-dialog-button-${index}`}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function labelFor(button: DialogButton): string {
  return button.text ?? 'OK';
}

/**
 * `destructive` is the only style that earns the red primary — emptying a
 * cart, cancelling an order, deleting an account. `cancel` is the way out and
 * takes the quietest treatment, so the eye lands on the consequence rather
 * than on the escape hatch.
 */
function variantFor(button: DialogButton): 'destructive' | 'primary' | 'text' {
  if (button.style === 'destructive') return 'destructive';
  if (button.style === 'cancel') return 'text';
  return 'primary';
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.gutter,
    backgroundColor: 'rgba(26, 26, 26, 0.55)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  title: { marginBottom: spacing.sm },
  message: { marginBottom: spacing.xl },
  actions: { gap: spacing.sm },
  /*
   * Array order, not reversed.
   *
   * Every call site already writes cancel first, because that is the order
   * `Alert.alert` wants on iOS — so laying them out in order puts the way out
   * on the left and the consequence on the right, which is where iOS,
   * Android and the web all put a confirming action. Reversing it, as this
   * first did, produced "Empty cart | Keep it" and invited a thumb heading
   * for the safe button to land on the destructive one.
   */
  actionsInline: { flexDirection: 'row', alignItems: 'center' },
  inlineButton: { flex: 1 },
});
