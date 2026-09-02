import fs from 'node:fs';
import path from 'node:path';
import { act, render, waitFor } from '@testing-library/react-native';
import { DialogHost } from '@/components/system/DialogHost';
import { ask, tell, useDialogStore } from '@/ux/dialog';

const root = path.resolve(__dirname, '..');

/**
 * Asking the customer something, and being able to prove they were asked.
 *
 * The bug this exists for was reported as "I can't clear cart after ordering",
 * and the cart was the least of it. Every confirmation in the app went through
 * `Alert.alert`, and this is react-native-web's implementation, in full:
 *
 *     class Alert {
 *       static alert() {}
 *     }
 *
 * An empty function — no dialog, no error, no trace. On the web build, Clear
 * did nothing, Cancel order did nothing, Sign out did nothing, Delete your
 * account did nothing, and every failure message was swallowed. Seventeen call
 * sites, all silent.
 *
 * Nothing could catch it. The unit tests render under the native mock, where
 * `Alert.alert` is a jest.fn that records the call, so asserting it was called
 * proved only that the app *intended* to ask. And `audit:screens` sweeps for
 * overflow, blank screens, console errors and touch targets — a dialog that
 * never opens produces none of those. The defect lived exactly in the gap
 * between "the call happened" and "the customer saw something".
 *
 * So these tests assert on the rendered dialog, and the guard at the bottom
 * keeps `Alert` out of the app entirely.
 */
afterEach(() => {
  act(() => useDialogStore.getState().reset());
});

describe('a confirmation the customer can actually answer', () => {
  it('renders the question, and resolves true when it is taken', async () => {
    const screen = render(<DialogHost />);

    let answer: boolean | undefined;
    void act(() => {
      void ask({
        title: 'Empty your cart?',
        message: 'This removes everything you have added so far.',
        confirmLabel: 'Empty cart',
        cancelLabel: 'Keep it',
        destructive: true,
      }).then((result) => {
        answer = result;
      });
    });

    // On the screen, not merely requested.
    expect(await screen.findByTestId('dialog')).toBeTruthy();
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Empty your cart?');
    expect(screen.getByText('This removes everything you have added so far.')).toBeTruthy();

    act(() => screen.getByTestId('dialog-confirm').props.onClick?.({}));
    await waitFor(() => expect(answer).toBe(true));
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('resolves false on cancel, and leaves nothing on screen', async () => {
    const screen = render(<DialogHost />);
    let answer: boolean | undefined;
    void act(() => {
      void ask({
        title: 'Sign out?',
        confirmLabel: 'Sign out',
        cancelLabel: 'Stay signed in',
      }).then((result) => {
        answer = result;
      });
    });

    await screen.findByTestId('dialog');
    act(() => screen.getByTestId('dialog-cancel').props.onClick?.({}));
    await waitFor(() => expect(answer).toBe(false));
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  /**
   * Dismissing is not agreeing. The scrim, Escape and Android back all land
   * here, and every destructive confirmation in the app reads the result as
   * "only act on true" — so an accidental dismissal can never delete anything.
   */
  it('treats a dismissal as a no', async () => {
    const screen = render(<DialogHost />);
    let answer: boolean | undefined;
    void act(() => {
      void ask({
        title: 'Delete your account?',
        confirmLabel: 'Delete account',
        destructive: true,
      }).then((result) => {
        answer = result;
      });
    });

    await screen.findByTestId('dialog');
    act(() => screen.getByTestId('dialog-scrim').props.onClick?.({}));
    await waitFor(() => expect(answer).toBe(false));
  });

  it('gives a notice one button and nothing to decide', async () => {
    const screen = render(<DialogHost />);
    void act(() => {
      void tell('Could not save', 'Please try again shortly.');
    });

    await screen.findByTestId('dialog');
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Could not save');
    expect(screen.queryByTestId('dialog-cancel')).toBeNull();
  });
});

describe('two things asking at once', () => {
  /**
   * Not hypothetical. Cancelling an order opens a confirmation whose failure
   * path opens a second dialog — and losing that one would leave the customer
   * believing the cancellation had worked.
   */
  it('queues the second and shows it once the first is answered', async () => {
    const screen = render(<DialogHost />);
    const answers: string[] = [];

    void act(() => {
      void ask({ title: 'First', confirmLabel: 'Yes' }).then(() => answers.push('first'));
      void ask({ title: 'Second', confirmLabel: 'Yes' }).then(() => answers.push('second'));
    });

    await screen.findByTestId('dialog');
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('First');

    act(() => screen.getByTestId('dialog-confirm').props.onClick?.({}));
    await waitFor(() => expect(screen.getByTestId('dialog-title')).toHaveTextContent('Second'));

    act(() => screen.getByTestId('dialog-confirm').props.onClick?.({}));
    await waitFor(() => expect(answers).toEqual(['first', 'second']));
  });

  it('settles everything still waiting when the queue is dropped', async () => {
    const settled: boolean[] = [];
    void act(() => {
      void ask({ title: 'One', confirmLabel: 'Yes' }).then((r) => settled.push(r));
      void ask({ title: 'Two', confirmLabel: 'Yes' }).then((r) => settled.push(r));
    });

    act(() => useDialogStore.getState().reset());
    // An awaited `ask` that never settles leaves its caller stuck for the life
    // of the process, so dropping the queue answers rather than abandons.
    await waitFor(() => expect(settled).toEqual([false, false]));
  });
});

describe('Alert stays out of the app', () => {
  /**
   * The guard, and the reason it is a source scan rather than a lint rule:
   * `Alert.alert` is not wrong, it is *inert on one platform*, which no type
   * and no test double can express. The only reliable statement is that the
   * app does not reach for it.
   */
  it('is imported nowhere in src, so no dialog can be silently dropped again', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;

        const source = fs.readFileSync(full, 'utf8');
        // Comments explain the history in a few places; the import and the
        // call are what matter.
        const withoutComments = source
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');
        if (/\bAlert\s*\.\s*alert\b/.test(withoutComments)) {
          offenders.push(path.relative(root, full));
        }
      }
    };
    walk(path.join(root, 'src'));

    expect(offenders).toEqual([]);
  });

  it('scanned a real tree rather than passing on an empty walk', () => {
    // The way a source scan fails silently is by reading nothing.
    let files = 0;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) files += 1;
      }
    };
    walk(path.join(root, 'src'));
    expect(files).toBeGreaterThan(100);
  });
});
