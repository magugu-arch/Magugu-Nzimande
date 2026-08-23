import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { OfflineBanner } from '@/components/system/OfflineBanner';
import { useReduceMotion } from '@/features/system/useReduceMotion';
import * as networkStatus from '@/features/system/useNetworkStatus';
import { announce } from '@/utils/accessibility';

jest.mock('@/features/system/useNetworkStatus', () => ({
  ...jest.requireActual('@/features/system/useNetworkStatus'),
  useNetworkStatus: jest.fn(),
}));

const useNetworkStatus = networkStatus.useNetworkStatus as jest.MockedFunction<
  typeof networkStatus.useNetworkStatus
>;

const offline = (isOffline: boolean) =>
  ({ isOffline, isConnected: !isOffline, isInternetReachable: !isOffline }) as ReturnType<
    typeof networkStatus.useNetworkStatus
  >;

describe('announce', () => {
  it('passes the message to the platform', () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce('Ready for collection.');
    expect(spy).toHaveBeenCalledWith('Ready for collection.');
    spy.mockRestore();
  });

  it('stays quiet rather than announcing nothing', () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce('   ');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('useReduceMotion', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reads the current setting', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const { result } = renderHook(() => useReduceMotion());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('starts from false rather than flashing a motionless first frame', () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const { result } = renderHook(() => useReduceMotion());
    // The platform read is asynchronous; the first render cannot know yet.
    expect(result.current).toBe(false);
  });

  it('follows the setting being changed while the app is open', async () => {
    let notify: ((enabled: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      _event: string,
      handler: (enabled: boolean) => void,
    ) => {
      notify = handler;
      return { remove: jest.fn() };
    }) as unknown as typeof AccessibilityInfo.addEventListener);

    const { result } = renderHook(() => useReduceMotion());
    await waitFor(() => expect(result.current).toBe(false));

    // iOS puts this in Control Centre, so it can change mid-session.
    act(() => notify?.(true));
    expect(result.current).toBe(true);
  });
});

/**
 * The banner reads the safe-area inset, which needs a provider with a known
 * frame — without one the metrics never resolve under test.
 */
function Wrapped({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {children}
    </SafeAreaProvider>
  );
}

describe('OfflineBanner announcements', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    // The RN preset already replaces this platform method with a jest.fn, so
    // `spyOn` hands back that same mock rather than wrapping a real function —
    // and `restoreAllMocks` cannot reset a mock that has no original to
    // restore. Without this, call counts accumulate across tests in the file.
    spy.mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  /**
   * The bug this prevents: an effect that announces on every run opens the app
   * with "Back online", which is both untrue and startling.
   */
  it('says nothing on the first render when online', () => {
    useNetworkStatus.mockReturnValue(offline(false));
    render(<OfflineBanner />, { wrapper: Wrapped });
    expect(spy).not.toHaveBeenCalled();
  });

  it('says nothing on the first render when already offline', () => {
    // The bar is on screen and carries accessibilityRole="alert", so the
    // reader picks it up without being told twice.
    useNetworkStatus.mockReturnValue(offline(true));
    render(<OfflineBanner />, { wrapper: Wrapped });
    expect(spy).not.toHaveBeenCalled();
  });

  it('announces the connection dropping while the customer is reading', () => {
    useNetworkStatus.mockReturnValue(offline(false));
    const { rerender } = render(<OfflineBanner />, { wrapper: Wrapped });

    useNetworkStatus.mockReturnValue(offline(true));
    rerender(<OfflineBanner />);

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("You're offline"));
  });

  it('announces it coming back', () => {
    useNetworkStatus.mockReturnValue(offline(true));
    const { rerender } = render(<OfflineBanner />, { wrapper: Wrapped });

    useNetworkStatus.mockReturnValue(offline(false));
    rerender(<OfflineBanner />);

    expect(spy).toHaveBeenCalledWith('Back online.');
  });

  it('does not repeat itself on a re-render that changed nothing', () => {
    useNetworkStatus.mockReturnValue(offline(false));
    const { rerender } = render(<OfflineBanner />, { wrapper: Wrapped });

    useNetworkStatus.mockReturnValue(offline(true));
    rerender(<OfflineBanner />);
    rerender(<OfflineBanner />);
    rerender(<OfflineBanner />);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
