import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { config } from '@/constants/config';

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

/**
 * The offline decision, exported so it can be tested without NetInfo — it is
 * the part that was wrong, and it was wrong in a way no screen test could see.
 */
export function toStatus(state: NetInfoState): NetworkStatus {
  const isConnected = state.isConnected ?? false;
  const isInternetReachable = state.isInternetReachable ?? null;
  return {
    isConnected,
    isInternetReachable,
    type: state.type,
    // With the mock layer on, every screen is served from the device, so
    // whether an API host answers says nothing about whether the app works.
    // It said plenty anyway: `apiBaseUrl` defaults to a host that does not
    // answer yet, so the probe failed, and the app declared itself offline
    // within two seconds of launch and stayed there — on every build that
    // exists today, while working perfectly. Measured in a browser: the
    // banner was up at t+2s, t+6s and t+12s, with
    // `api.bbqchicken.co.za/health` failing at the transport.
    isOffline: config.useMockApi ? !isConnected : !isConnected || isInternetReachable === false,
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
  // Out of the box NetInfo decides whether the internet is reachable by
  // fetching a Google endpoint. That makes "are we online?" mean "can we reach
  // Google?", which is the wrong question and one that gets the wrong answer on
  // a filtered corporate network or behind a captive portal — the app would sit
  // there claiming to be offline while our own API answered fine.
  //
  // Pointing the probe at our own API asks the question that actually matters.
  // Any HTTP response counts, including a 404: we are testing whether packets
  // reach the host, not whether that path exists. Only a transport-level
  // failure, where fetch rejects and this never runs, means offline.
  NetInfo.configure({
    reachabilityUrl: `${config.apiBaseUrl}/health`,
    reachabilityTest: () => Promise.resolve(true),
    reachabilityLongTimeout: 60 * 1000,
    reachabilityShortTimeout: 5 * 1000,
    reachabilityRequestTimeout: 10 * 1000,
    // Nothing to probe when nothing is fetched. Beyond the false banner, this
    // stops a mock build firing a request every minute at a domain that is
    // not answering and may not even be ours yet.
    reachabilityShouldRun: () => !config.useMockApi,
  });

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
