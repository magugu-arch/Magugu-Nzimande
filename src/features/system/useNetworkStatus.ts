import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

export interface NetworkStatus {
  /** The device reports a connection. */
  isConnected: boolean;
  /** The connection actually reaches the internet. Null while unknown. */
  isInternetReachable: boolean | null;
  /** Cellular, wifi, none… */
  type: string;
  /**
   * True only when we are confident the app is offline. Deliberately
   * conservative: `isInternetReachable` is null while the probe is in flight,
   * and treating that as offline would flash a banner on every cold start.
   */
  isOffline: boolean;
}

function toStatus(state: NetInfoState): NetworkStatus {
  const isConnected = state.isConnected ?? false;
  const isInternetReachable = state.isInternetReachable ?? null;
  return {
    isConnected,
    isInternetReachable,
    type: state.type,
    isOffline: !isConnected || isInternetReachable === false,
  };
}

/**
 * Teach TanStack Query about connectivity (brief §12, offline-aware behaviour).
 *
 * Without this, queries fired while offline burn their retries immediately and
 * land on an error state; with it they pause and resume on reconnect, so a
 * customer coming out of a lift sees their data arrive rather than an error
 * they have to dismiss.
 *
 * Called once at app start, outside React, so it is in place before the first
 * query runs.
 */
export function startNetworkMonitoring(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      const { isOffline } = toStatus(state);
      setOnline(!isOffline);
    }),
  );
}

/** Subscribe a component to connectivity changes. */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: null,
    type: 'unknown',
    isOffline: false,
  });

  useEffect(() => {
    let active = true;

    void NetInfo.fetch().then((state) => {
      if (active) setStatus(toStatus(state));
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (active) setStatus(toStatus(state));
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return status;
}
