import { useDialogStore, type DialogButton } from '@/features/system/dialogStore';

/**
 * The app's replacement for `Alert.alert`.
 *
 * Deliberately the same shape, so a call site ports by changing one word:
 *
 *     Alert.alert('Empty your cart?', 'This removes everything.', [...])
 *     Dialog.alert('Empty your cart?', 'This removes everything.', [...])
 *
 * The signature match is not laziness. `Alert.alert` is what every React
 * Native developer reaches for, and the next person to add a confirmation to
 * this app will type it from muscle memory. Keeping the shape identical means
 * the lint rule that bans the import (see `.eslintrc`) can point at a
 * replacement that needs no thought to adopt — and a rule with a one-word fix
 * is a rule people follow.
 *
 * It is a plain object rather than a hook because most callers are not
 * components: mutation callbacks, `useReorder`, and `linking.ts` all raise
 * dialogs from outside a render.
 */
export const Dialog = {
  alert(title: string, message?: string, buttons?: DialogButton[]): void {
    useDialogStore.getState().show(title, message, buttons);
  },
};

export type { DialogButton };
