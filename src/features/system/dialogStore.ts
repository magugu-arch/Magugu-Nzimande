import { create } from 'zustand';

/**
 * The app's own confirmation dialogs.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * Every confirmation in this app went through `Alert.alert`, and on web that
 * call is this, in full:
 *
 *     class Alert { static alert() {} }
 *
 * An empty body. React Native Web ships `Alert` so imports resolve, and then
 * does nothing with it. On the published HTML build that meant *sixteen* dead
 * controls — Clear cart, Sign out, Remove address, Remove payment method,
 * Cancel order, Delete account, and every error message routed through an
 * alert. Press Clear and nothing happens at all: no dialog, no cart emptied,
 * no error in the console. The button was wired correctly to a function that
 * had been defined to do nothing.
 *
 * That is the same defect class as a price field nothing reads, which is what
 * makes it worth naming: the call site looks right, the types check, and the
 * behaviour is absent. Nothing can fail, because nothing runs.
 *
 * ── Why a store rather than a web shim ───────────────────────────────────
 *
 * `window.confirm` would have made the buttons work on web in one line. It
 * also renders Chrome's own grey dialog with the page's URL above it, in the
 * system font, with OK and Cancel — no destructive red, no Pappas type, and
 * on iOS Safari a modal that blocks the whole tab. A restaurant app that asks
 * "Empty your cart?" in browser chrome has stopped being the restaurant's app
 * at that moment.
 *
 * So the dialog is drawn by the app, from the same tokens as everything else,
 * and behaves identically on iOS, Android and web. `Modal` is used underneath
 * and *is* properly implemented on web — portal, focus trap, Escape key — so
 * this is a component problem rather than a platform one.
 *
 * ── Why the state is global ──────────────────────────────────────────────
 *
 * Because the callers are not components. `useReorder` raises a dialog from
 * inside a mutation callback, and `linking.ts` from a utility with no render
 * tree at all. A hook-based dialog would have forced both to become
 * components. A store can be written to from anywhere, and the host that
 * renders it is mounted once, above the navigator, so a dialog survives the
 * screen that opened it.
 */

/** Mirrors React Native's `AlertButton`, so call sites port across unchanged. */
export interface DialogButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface DialogRequest {
  /**
   * Monotonic, and the key the host renders under. Two dialogs raised in the
   * same tick must not be coalesced into one by a stale-equality check.
   */
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
}

interface DialogState {
  request: DialogRequest | null;
  show: (title: string, message?: string, buttons?: DialogButton[]) => void;
  /**
   * Close, and run the chosen button's handler.
   *
   * The handler runs *after* the request is cleared, so a handler that raises
   * a second dialog — "remove this address" failing, then reporting why —
   * replaces the first rather than being wiped out by its own dismissal.
   */
  resolve: (index: number) => void;
  /** Escape, backdrop, or the Android back button. */
  dismiss: () => void;
}

/** A dialog with no buttons still needs a way out. */
const DEFAULT_BUTTONS: DialogButton[] = [{ text: 'OK', style: 'default' }];

let nextId = 0;

export const useDialogStore = create<DialogState>((set, get) => ({
  request: null,

  show: (title, message, buttons) => {
    nextId += 1;
    set({
      request: {
        id: nextId,
        title,
        ...(message === undefined ? {} : { message }),
        buttons: buttons && buttons.length > 0 ? buttons : DEFAULT_BUTTONS,
      },
    });
  },

  resolve: (index) => {
    const { request } = get();
    if (!request) return;
    const button = request.buttons[index];
    set({ request: null });
    button?.onPress?.();
  },

  dismiss: () => {
    const { request } = get();
    if (!request) return;
    set({ request: null });

    /*
     * Dismissing is choosing the cancel button, where one exists. On iOS a
     * swipe-away and a Cancel tap are the same act, and a caller that puts
     * cleanup in its cancel handler is entitled to have it run either way.
     *
     * With no cancel button, dismissing runs nothing. A single-button "that
     * did not work" notice is informational, and pressing Escape on it must
     * not fire whatever OK would have done.
     */
    const cancel = request.buttons.find((button) => button.style === 'cancel');
    cancel?.onPress?.();
  },
}));

/** Whether a dismissal is allowed at all — see `DialogHost`. */
export function isDismissable(request: DialogRequest): boolean {
  return (
    request.buttons.some((button) => button.style === 'cancel') || request.buttons.length === 1
  );
}
