import { Text as RNText } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AdapterError } from '@/core/adapters/errors';
import type { DomainQuery } from '@/data/useDomainQuery';
import { Button, QueryState, StateView } from '@/design';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

const q = <T,>(over: Partial<DomainQuery<T>>): DomainQuery<T> => ({
  status: 'success',
  data: undefined,
  error: null,
  fromCache: null,
  isRefreshing: false,
  refetch: jest.fn(),
  ...over,
});

describe('screen states (brief §29)', () => {
  it('shows a skeleton while loading', () => {
    render(
      <QueryState query={q<string>({ status: 'loading' })}>
        {(d) => <RNText>{d}</RNText>}
      </QueryState>,
    );
    expect(screen.getByLabelText('Loading')).toBeTruthy();
  });

  it('renders data on success', () => {
    render(<QueryState query={q({ data: 'hello' })}>{(d) => <RNText>{d}</RNText>}</QueryState>);
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('offers a retry on error', () => {
    const refetch = jest.fn();
    render(
      <QueryState
        query={q<string>({
          status: 'error',
          error: new AdapterError('unavailable', 'finance'),
          refetch,
        })}
        what="your fees"
      >
        {(d) => <RNText>{d}</RNText>}
      </QueryState>,
    );
    expect(screen.getByText('We couldn’t load your fees')).toBeTruthy();
    fireEvent.press(screen.getByText('Try again'));
    expect(refetch).toHaveBeenCalled();
  });

  it('says offline, not error, when there is no connection', () => {
    render(
      <QueryState
        query={q<string>({ status: 'error', error: new AdapterError('offline', 'academic') })}
      >
        {(d) => <RNText>{d}</RNText>}
      </QueryState>,
    );
    expect(screen.getByText('You’re offline')).toBeTruthy();
  });

  it('labels an offline copy so it is never mistaken for live data', () => {
    render(
      <QueryState query={q({ data: 'cached', fromCache: { savedAt: new Date().toISOString() } })}>
        {(d) => <RNText>{d}</RNText>}
      </QueryState>,
    );
    expect(screen.getByTestId('offline-copy')).toBeTruthy();
    expect(screen.getByText('cached')).toBeTruthy();
  });

  it('shows the permission-denied state for a forbidden response', () => {
    render(
      <QueryState
        query={q<string>({ status: 'error', error: new AdapterError('forbidden', 'guardian') })}
      >
        {(d) => <RNText>{d}</RNText>}
      </QueryState>,
    );
    expect(screen.getByTestId('state-denied')).toBeTruthy();
  });

  it('shows an empty state when there is nothing', () => {
    render(
      <QueryState
        query={q({ data: [] as string[] })}
        isEmpty={(d) => d.length === 0}
        empty={<StateView kind="empty" title="No bookings yet" />}
      >
        {() => <RNText>list</RNText>}
      </QueryState>,
    );
    expect(screen.getByText('No bookings yet')).toBeTruthy();
  });
});

describe('Button', () => {
  it('is a labelled button that reports busy and disabled states', () => {
    const onPress = jest.fn();
    render(<Button label="Pay R62.00" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Pay R62.00' });
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
