import { render, screen } from '@testing-library/react-native';
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

  it('reassures the customer their cart survived', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/cart is saved/i)).toBeTruthy();
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
