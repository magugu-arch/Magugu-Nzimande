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
/**
 * How often to re-ask while offline. Frequent enough that a customer coming
 * out of a lift does not notice, rare enough to be free.
 */
const RECOVERY_POLL_MS = 3000;

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

  onlineManager.setEventListener((setOnline) => {
    let offline = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const apply = (state: NetInfoState) => {
      const next = toStatus(state).isOffline;
      if (next === offline) return;
      offline = next;
      setOnline(!next);
      // Same reason as the hook below: the drop is reported, the recovery is
      // not always. Queries paused offline resume only when this says so, so
      // a missed event does not mean a stale banner — it means the customer's
      // orders and menu never arrive after they come out of the lift.
      if (next) {
        timer = setInterval(() => {
          void NetInfo.fetch().then(apply);
        }, RECOVERY_POLL_MS);
      } else {
        stopPolling();
      }
    };

    const unsubscribe = NetInfo.addEventListener(apply);
    return () => {
      stopPolling();
      unsubscribe();
    };
  });
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

    const apply = (state: NetInfoState) => {
      if (active) setStatus(toStatus(state));
    };

    void NetInfo.fetch().then(apply);
    const unsubscribe = NetInfo.addEventListener(apply);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  /**
   * Ask again while we believe we are offline.
   *
   * Going offline is reported reliably; coming back is not. Driven in a
   * browser, the app dropped to offline correctly and then never recovered —
   * `navigator.onLine` was true again, and the banner was still up and
   * checkout still blocked, because the subscription had emitted nothing on
   * the way back.
   *
   * That was survivable while a stale banner was only cosmetic. It stopped
   * being survivable when checkout started refusing to take an order offline:
   * a customer who walks through a lift on the way to paying would have been
   * stuck until they killed the app.
   *
   * So this does not trust the event to arrive. It polls only while offline,
   * stops the moment we are back, and is a plain re-read of state NetInfo
   * already holds — no request, and nothing at all in the common case.
   */
  useEffect(() => {
    if (!status.isOffline) return;

    const timer = setInterval(() => {
      void NetInfo.fetch().then((state) => setStatus(toStatus(state)));
    }, RECOVERY_POLL_MS);

    return () => clearInterval(timer);
  }, [status.isOffline]);

  return status;
}
