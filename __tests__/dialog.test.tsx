import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { DialogHost } from '@/components/system/DialogHost';
import { useDialogStore, isDismissable } from '@/features/system/dialogStore';
import { Dialog } from '@/utils/dialog';

/**
 * Confirmations, and the platform trap that made every one of them dead.
 *
 * `Alert.alert` on React Native Web is `static alert() {}` — an empty body.
 * Sixteen confirmations in this app went through it, so in the published web
 * build Clear cart, Sign out, Remove address, Remove payment method, Cancel
 * order and Delete account all did nothing at all when pressed. No dialog, no
 * effect, no error. The call sites were correct; the function was not there.
 *
 * The first test below is the one that matters most, because it is the only
 * one that would have caught this before a customer did.
 */

beforeEach(() => {
  useDialogStore.setState({ request: null });
});

/**
 * `Dialog.alert` writes to a store from outside React, which is the whole
 * point of it — the real callers are mutation callbacks and utilities. In a
 * test that means the render it triggers has to be flushed explicitly.
 */
const raise = (...args: Parameters<typeof Dialog.alert>) => {
  act(() => Dialog.alert(...args));
};

/**
 * The backdrop is deliberately absent from the accessibility tree — it is a
 * convenience for a pointer, and a reader user already has Escape and the
 * buttons themselves. Testing Library honours that and will not return it by
 * default, so the test has to say it is reaching for a hidden element on
 * purpose.
 */
const backdrop = () => screen.getByTestId('app-dialog-backdrop', { includeHiddenElements: true });

describe('the platform trap itself', () => {
  /**
   * Reached through `react-native-web` by its own path rather than through
   * `react-native`, because under Jest the bare specifier resolves to the
   * native module — which does implement Alert, and would make this pass for
   * the wrong reason. The published HTML build resolves it to this file, so
   * this is the implementation the customer actually pressed.
   *
   * The assertion is not that it returns undefined, which any function might.
   * It is that the handler is never called: the button the customer chose is
   * simply discarded. That is the defect, stated exactly.
   *
   * If a future React Native Web implements Alert properly this fails, and
   * the failure is the news — the lint ban can then be reconsidered.
   */
  it('drops the handler entirely on web', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WebAlert = require('react-native-web/dist/exports/Alert').default;
    const onPress = jest.fn();

    expect(
      WebAlert.alert('Empty your cart?', 'Gone for good', [
        { text: 'Empty cart', style: 'destructive', onPress },
      ]),
    ).toBeUndefined();

    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('raising a dialog from outside a component', () => {
  /**
   * `useReorder` and `linking.ts` both raise dialogs from places with no
   * render tree, which is the whole reason the state is a store.
   */
  it('reaches the host without a hook', () => {
    render(<DialogHost />);
    expect(screen.queryByTestId('app-dialog')).toBeNull();

    raise('Empty your cart?', 'This removes everything you have added so far.');

    expect(screen.getByTestId('app-dialog-title')).toHaveTextContent('Empty your cart?');
    expect(screen.getByTestId('app-dialog-message')).toHaveTextContent(
      'This removes everything you have added so far.',
    );
  });

  it('gives a dialog with no buttons a way out', () => {
    render(<DialogHost />);
    raise('One moment', 'We are still loading the menu.');

    expect(screen.getByTestId('app-dialog-button-0')).toHaveTextContent('OK');
    expect(screen.queryByTestId('app-dialog-button-1')).toBeNull();
  });
});

describe('choosing a button', () => {
  it('runs that button and closes', () => {
    const clear = jest.fn();
    render(<DialogHost />);

    raise('Empty your cart?', undefined, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Empty cart', style: 'destructive', onPress: clear },
    ]);

    fireEvent.press(screen.getByTestId('app-dialog-button-1'));

    expect(clear).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('app-dialog')).toBeNull();
  });

  it('runs nothing when the cancel button is the one chosen', () => {
    const clear = jest.fn();
    render(<DialogHost />);

    raise('Empty your cart?', undefined, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Empty cart', style: 'destructive', onPress: clear },
    ]);

    fireEvent.press(screen.getByTestId('app-dialog-button-0'));

    expect(clear).not.toHaveBeenCalled();
    expect(screen.queryByTestId('app-dialog')).toBeNull();
  });

  /**
   * A handler that raises a second dialog — an address removal failing, then
   * saying why — must not have its dialog wiped by the first one's dismissal.
   * That is why `resolve` clears the request before running the handler.
   */
  it('lets a handler raise the next dialog', () => {
    render(<DialogHost />);

    raise('Remove this address?', undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => Dialog.alert('That did not work', 'Try again in a moment.'),
      },
    ]);

    fireEvent.press(screen.getByTestId('app-dialog-button-1'));

    expect(screen.getByTestId('app-dialog-title')).toHaveTextContent('That did not work');
  });
});

describe('dismissing', () => {
  /**
   * Swiping a dialog away and pressing Cancel are the same act, so a caller
   * that put cleanup in its cancel handler is entitled to have it run either
   * way.
   */
  it('counts as choosing cancel', () => {
    const onCancel = jest.fn();
    render(<DialogHost />);

    raise('Sign out?', undefined, [
      { text: 'Stay', style: 'cancel', onPress: onCancel },
      { text: 'Sign out', onPress: jest.fn() },
    ]);

    fireEvent.press(backdrop());

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('app-dialog')).toBeNull();
  });

  /**
   * An informational one-button notice must not fire its OK handler on a
   * dismiss — dismissing is not agreeing.
   */
  it('runs nothing on a single-button notice', () => {
    const onOk = jest.fn();
    render(<DialogHost />);

    raise('That code did not work', undefined, [{ text: 'OK', onPress: onOk }]);
    fireEvent.press(backdrop());

    expect(onOk).not.toHaveBeenCalled();
    expect(screen.queryByTestId('app-dialog')).toBeNull();
  });

  /**
   * A destructive confirmation with no cancel button has no safe dismissal —
   * Escape or a backdrop tap must not be able to stand in for a decision.
   */
  it('is refused where there is no way to decline', () => {
    const request = {
      id: 1,
      title: 'Confirm',
      buttons: [{ text: 'Delete', style: 'destructive' as const }, { text: 'Archive' }],
    };
    expect(isDismissable(request)).toBe(false);

    render(<DialogHost />);
    act(() => useDialogStore.setState({ request }));
    fireEvent.press(backdrop());

    expect(screen.getByTestId('app-dialog')).toBeTruthy();
  });
});

describe('the shape matches Alert.alert', () => {
  /**
   * The point of the signature match is that porting a call site is one word.
   * This is the exact argument list the cart used before the change.
   */
  it('takes title, message and buttons positionally', () => {
    const clear = jest.fn();
    render(<DialogHost />);

    raise('Empty your cart?', 'This removes everything you have added so far.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Empty cart', style: 'destructive', onPress: clear },
    ]);

    expect(screen.getByTestId('app-dialog-title')).toHaveTextContent('Empty your cart?');
    fireEvent.press(screen.getByTestId('app-dialog-button-1'));
    expect(clear).toHaveBeenCalled();
  });
});
