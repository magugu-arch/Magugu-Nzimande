import { fireEvent, render, screen } from '@testing-library/react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Text } from '@/components/ui';

function Boom(): never {
  throw new Error('kitchen fire');
}

describe('ErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    // React logs the caught error itself; silence it so the suite output
    // stays readable without hiding genuine failures.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Text>Golden Original</Text>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Golden Original')).toBeTruthy();
    expect(screen.queryByTestId('error-boundary')).toBeNull();
  });

  it('shows the recovery screen instead of unmounting to a blank view', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('error-boundary')).toBeTruthy();
    expect(screen.getByText('Something broke')).toBeTruthy();
    // The customer needs a way forward, not just an apology.
    expect(screen.getByTestId('error-retry')).toBeTruthy();
  });

  /**
   * This test used to assert the opposite, and the sentence it was holding in
   * place was false in the one case that matters most.
   *
   * The screen said "Your cart is saved, so nothing is lost". Driven in
   * Chromium against a saved basket the app could not read — `lines: null`, or
   * a line written without `selectedOptions` — the cart was precisely what was
   * lost, it was the *cause* of the crash, and pressing Try again re-read it
   * and crashed again. A reassurance is worse than nothing when it names the
   * thing that is broken.
   *
   * What the app can promise at this point is narrower and true: nothing has
   * been ordered. `submitOrder` clears the basket only after an order exists,
   * so a crash cannot have left one half-placed.
   */
  it('promises only what it can keep', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Nothing has been ordered/i)).toBeTruthy();
    expect(screen.queryByText(/cart is saved/i)).toBeNull();
  });

  /**
   * And the way out of a crash that retrying cannot fix.
   *
   * Offered only after a retry has already failed: a transient crash clears on
   * the first press, and one caused by a stored value comes straight back.
   * Wiping somebody's basket before they have even tried is a worse first
   * impression than the crash.
   */
  it('offers no escape hatch until a retry has actually failed', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.queryByTestId('error-clear-storage')).toBeNull();

    fireEvent.press(screen.getByTestId('error-retry'));

    // The child throws again on the re-render, which is exactly the loop a
    // poisoned stored value produces.
    expect(screen.getByTestId('error-clear-storage')).toBeTruthy();
  });

  it('tells the customer what starting fresh costs them, and what it does not', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    fireEvent.press(screen.getByTestId('error-retry'));

    expect(screen.getByText(/clears your basket and saved choices/i)).toBeTruthy();
    expect(screen.getByText(/account and your order history are not touched/i)).toBeTruthy();
  });

  it('reports the error to the supplied handler for crash reporting', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0]?.[0] as Error).message).toBe('kitchen fire');
  });
});
