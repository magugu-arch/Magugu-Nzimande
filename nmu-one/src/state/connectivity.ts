import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';
import { connectivity } from '@/core/adapters/runtime';

/**
 * Connectivity for the UI (offline banner) and the adapters (fail fast with
 * `offline` rather than hang). React Query's own online manager is kept in
 * step so it refetches when the connection returns.
 */
interface ConnectivityState {
  online: boolean;
}

export const useConnectivity = create<ConnectivityState>(() => ({ online: true }));

function apply(online: boolean) {
  connectivity.setOnline(online);
  onlineManager.setOnline(online);
  useConnectivity.setState({ online });
}

let started = false;

export function startConnectivityMonitoring(): void {
  if (started) return;
  started = true;
  // No reachability probes: NetInfo would otherwise ping a third-party URL
  // (unnecessary network work, brief §30) and, on locked-down campus Wi-Fi,
  // report a working connection as offline. The OS connection state is enough.
  NetInfo.configure({ reachabilityShouldRun: () => false });
  NetInfo.addEventListener((state) => {
    // With probes off, NetInfo reports `isInternetReachable: false` whatever
    // the connection, so only the OS connection state is read. A `null`
    // (still unknown) counts as online so the banner never flashes on launch.
    apply(state.isConnected !== false);
  });
}

export const useOnline = () => useConnectivity((s) => s.online);
