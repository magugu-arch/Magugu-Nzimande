import { create } from 'zustand';

/**
 * Asking the customer something, on every platform.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The app used `Alert.alert` for every confirmation and every piece of bad
 * news. On iOS and Android that is the right control. On web it is this, in
 * full, from `react-native-web/dist/exports/Alert/index.js`:
 *
 *     class Alert {
 *       static alert() {}
 *     }
 *
 * An empty function. Not a warning, not a throw — nothing. So on the web build
 * every one of those calls did precisely nothing, silently:
 *
 *     Empty your cart?          the reported bug: Clear did nothing at all
 *     Cancel this order?        no way to cancel an order
 *     Sign out?                 no way to sign out
 *     Delete your account?      a POPIA right, unreachable
 *     Remove this address / payment method?
 *     "We could not save that"  every failure message, swallowed
 *     reorder notices           substitutions never mentioned
 *
 * Seventeen call sites. The tests could not catch it because they render
 * components in a native-ish environment, and `audit:screens` could not
 * because a dialog that never opens leaves no trace on the screen — nothing
 * overflows, nothing errors, nothing is blank.
 *
 * ── Why one dialog everywhere, rather than a web fallback ──────────────────
 * `window.confirm` would have been two lines. It is also modal to the whole
 * browser, unstyled, unbranded, cannot express a destructive action, and is
 * blocked outright in some embedded contexts — including the kind of frame
 * this app is previewed in. More to the point, a second implementation is a
 * second thing to be wrong: the native path would still be the only one
 * anybody tested.
 *
 * So there is one dialog, drawn by the app, on all three platforms. It costs
 * iOS and Android their system alert — a deliberate trade, and the one every
 * comparable ordering app makes, because a branded sheet is also the only way
 * to get §22 buttons and §8 colours into a destructive confirmation.
 */
export interface DialogRequest {
  title: string;
  message?: string;
  /**
   * The affirmative button. Omitted for a plain notice, which gets a single
   * dismiss button and nothing to decide.
   */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Draws the affirmative button as destructive (§8 error red). */
  destructive?: boolean;
}

interface PendingDialog extends DialogRequest {
  id: number;
  resolve: (confirmed: boolean) => void;
}

interface DialogState {
  /** The dialog on screen, plus anything asked while it was open. */
  queue: PendingDialog[];
  push: (pending: PendingDialog) => void;
  /** Answer the front dialog and move to the next. */
  answer: (id: number, confirmed: boolean) => void;
  /** Drop everything unanswered — used when tearing down a test. */
  reset: () => void;
}

export const useDialogStore = create<DialogState>()((set, get) => ({
  queue: [],
  push: (pending) => set((state) => ({ queue: [...state.queue, pending] })),
  answer: (id, confirmed) => {
    const pending = get().queue.find((candidate) => candidate.id === id);
    if (!pending) return;
    // Removed before resolving, so a handler that asks something else in
    // response lands behind this one rather than racing it out of the queue.
    set((state) => ({ queue: state.queue.filter((candidate) => candidate.id !== id) }));
    pending.resolve(confirmed);
  },
  reset: () => {
    // Resolve rather than abandon: an awaited `ask` that never settles leaves
    // its caller stuck for the life of the process.
    for (const pending of get().queue) pending.resolve(false);
    set({ queue: [] });
  },
}));

let nextId = 0;

/**
 * Ask, and wait for the answer.
 *
 * Resolves `true` when the affirmative button is taken and `false` for cancel,
 * a tap outside, the Escape key or an Android back press — so the safe reading
 * of "no answer" is always the one that changes nothing.
 *
 *     if (await ask({ title: 'Empty your cart?', confirmLabel: 'Empty cart',
 *                     cancelLabel: 'Keep it', destructive: true })) clear();
 *
 * A notice is the same call without `confirmLabel`; the result is there to be
 * ignored.
 */
export function ask(request: DialogRequest): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    useDialogStore.getState().push({ ...request, id: (nextId += 1), resolve });
  });
}

/**
 * A notice with nothing to decide.
 *
 * The house rule, because the two are easy to mix up: **`ask` is awaited and
 * `tell` is not.** An `ask` is awaited because the answer decides what happens
 * next. A `tell` has no answer to wait for, and awaiting one makes the calling
 * function hang until the customer taps OK — which is how `openExternal` came
 * to sit on its own return value, reporting whether a phone call started only
 * once somebody had dismissed the message saying it had not. That is also
 * exactly what `Alert.alert` did before it: post the notice, carry on.
 *
 * The promise is returned all the same, for the rare caller that genuinely
 * wants to wait, and for the tests.
 */
export function tell(title: string, message?: string): Promise<boolean> {
  return ask(message === undefined ? { title } : { title, message });
}
