import type { NetInfoState } from '@react-native-community/netinfo';
import { toStatus } from '@/features/system/useNetworkStatus';
import { config } from '@/constants/config';

const state = (overrides: Partial<NetInfoState>): NetInfoState =>
  ({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: {},
    ...overrides,
  }) as NetInfoState;

/**
 * `apiBaseUrl` defaults to a host that does not answer yet, and the
 * reachability probe points at it. With the mock layer on — which is every
 * build that exists today, including anything shown to the franchise — the
 * probe failed, the app declared itself offline within two seconds of launch
 * and stayed there, while working perfectly on device data.
 *
 * Measured in a browser: the banner was up at t+2s, t+6s and t+12s, with
 * `api.bbqchicken.co.za/health` failing at the transport.
 */
describe('toStatus', () => {
  const withMock = (useMockApi: boolean, run: () => void) => {
    const original = config.useMockApi;
    (config as { useMockApi: boolean }).useMockApi = useMockApi;
    try {
      run();
    } finally {
      (config as { useMockApi: boolean }).useMockApi = original;
    }
  };

  it('does not call a mock build offline because an API host is unreachable', () => {
    withMock(true, () => {
      expect(toStatus(state({ isInternetReachable: false })).isOffline).toBe(false);
    });
  });

  it('still calls a mock build offline when the device has no connection', () => {
    withMock(true, () => {
      expect(toStatus(state({ isConnected: false })).isOffline).toBe(true);
    });
  });

  it('trusts the probe once the app talks to a real backend', () => {
    withMock(false, () => {
      expect(toStatus(state({ isInternetReachable: false })).isOffline).toBe(true);
      expect(toStatus(state({ isInternetReachable: true })).isOffline).toBe(false);
    });
  });

  /**
   * The probe is in flight on every cold start. Treating "not known yet" as
   * offline would flash the banner on every launch.
   */
  it('says nothing while the probe has not answered', () => {
    withMock(false, () => {
      expect(toStatus(state({ isInternetReachable: null })).isOffline).toBe(false);
    });
  });

  it('reports offline when the device says it is disconnected, either way', () => {
    withMock(false, () => {
      expect(toStatus(state({ isConnected: false, isInternetReachable: null })).isOffline).toBe(
        true,
      );
    });
  });
});
