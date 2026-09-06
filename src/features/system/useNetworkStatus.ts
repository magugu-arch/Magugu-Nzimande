import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
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
 * Whether this platform can be asked directly, and what it says.
 *
 * ── The gap this closes ────────────────────────────────────────────────────
 * NetInfo's web implementation binds its connectivity listener like this:
 *
 *     if (connection) connection.addEventListener('change', handler);
 *     else { window.addEventListener('online', handler);
 *            window.addEventListener('offline', handler); }
 *
 * `connection` is `navigator.connection`, the Network Information API — which
 * every Chromium browser has: Chrome, Edge, Samsung Internet, Android WebView.
 * So on all of them NetInfo listens to `connection.change` and **never** to
 * `online` or `offline`. And `change` fires when the *characteristics* of a
 * connection change — effectiveType, downlink, rtt — not when the device drops
 * off the network.
 *
 * Driven in Chromium, recording every event across a drop and a recovery:
 *
 *     going offline   conn:change/4g   win:offline
 *     coming back                      win:online
 *
 * One `change` on the way down, none on the way back. The banner arrived
 * because that single event happened to fire; it never left, because nothing
 * told the app the connection had returned. `audit:launch` has described this
 * for as long as it has existed — "could not be shown to detect regaining it:
 * driven in a browser it stayed offline with navigator.onLine true again" —
 * and the cause was one branch in a dependency.
 *
 * The 3s recovery poll below did not save it either: `NetInfo.fetch()` returns
 * the library's cached state, and the cache is only refreshed by the events
 * that were not arriving.
 *
 * So on web the browser is asked directly. `navigator.onLine` and its two
 * events are the primitives NetInfo would have used had `connection` been
 * absent, and they are the ones that actually fire. Native is untouched: there
 * NetInfo talks to the OS and is the right answer.
 */
const WEB = Platform.OS === 'web' && typeof window !== 'undefined';

function browserIsOnline(): boolean {
  // `navigator.onLine` false is a definite no; true only means the interface is
  // up, which is why the non-mock path still consults reachability on native.
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

/**
 * NetInfo's reading with the browser's own connectivity laid over it.
 *
 * Only the connectivity half is overridden, and the distinction is the whole
 * of it. Two different questions are being asked:
 *
 *   *is there a network?*        `navigator.onLine`, which NetInfo mis-binds on
 *                                Chromium and the browser answers reliably.
 *   *does it reach our API?*     NetInfo's reachability probe, which works fine
 *                                — it is delivered by a different mechanism.
 *
 * The first version of this replaced both, and `audit:offline` caught it
 * immediately: with the mock off and a host that does not answer, the browser
 * is online, so every screen went back to saying "something went wrong" instead
 * of naming the connection. Reachability was the half that had been carrying
 * that, and it had never been broken.
 */
function withBrowserConnectivity(base: NetworkStatus): NetworkStatus {
  if (!WEB) return base;

  const isConnected = browserIsOnline();
  // No network means nothing is reachable, whatever a stale probe last said.
  const isInternetReachable = isConnected ? base.isInternetReachable : false;

  return {
    isConnected,
    isInternetReachable,
    type: isConnected ? base.type : 'none',
    isOffline: config.useMockApi ? !isConnected : !isConnected || isInternetReachable === false,
  };
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
    /*
      Same correction as the hook, and it matters more here: this is what
      decides whether a paused query ever resumes. Bound to NetInfo, a customer
      coming out of a lift on a Chromium browser would have had their menu,
      orders and rewards stay paused indefinitely — the recovery event the
      library listens for does not fire there. See the note at the top.
    */
    let latest: NetInfoState | null = null;
    let offline = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const decide = () =>
      withBrowserConnectivity(
        latest
          ? toStatus(latest)
          : { isConnected: true, isInternetReachable: null, type: 'unknown', isOffline: false },
      ).isOffline;

    const republish = () => {
      const next = decide();
      if (next === offline) return;
      offline = next;
      setOnline(!next);
      if (next) {
        timer = setInterval(() => {
          void NetInfo.fetch().then(apply);
        }, RECOVERY_POLL_MS);
      } else {
        stopPolling();
      }
    };

    const apply = (state: NetInfoState) => {
      latest = state;
      const next = decide();
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

    void NetInfo.fetch().then(apply);
    const unsubscribe = NetInfo.addEventListener(apply);
    if (WEB) {
      window.addEventListener('online', republish);
      window.addEventListener('offline', republish);
    }
    return () => {
      stopPolling();
      unsubscribe();
      if (WEB) {
        window.removeEventListener('online', republish);
        window.removeEventListener('offline', republish);
      }
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

    // The last thing NetInfo said, kept so a browser `online` event can be
    // re-derived against it rather than throwing its reachability away.
    let latest: NetInfoState | null = null;

    const publish = () => {
      if (!active) return;
      setStatus(withBrowserConnectivity(latest ? toStatus(latest) : status));
    };

    const apply = (state: NetInfoState) => {
      latest = state;
      publish();
    };

    void NetInfo.fetch().then(apply);
    const unsubscribe = NetInfo.addEventListener(apply);

    // On web, the browser's own events are the ones that actually fire — see
    // the note at the top of this file. NetInfo stays subscribed for
    // reachability; these carry connectivity.
    if (WEB) {
      window.addEventListener('online', publish);
      window.addEventListener('offline', publish);
    }

    return () => {
      active = false;
      unsubscribe();
      if (WEB) {
        window.removeEventListener('online', publish);
        window.removeEventListener('offline', publish);
      }
    };
    // `status` is read only as a starting point for the very first publish, so
    // re-subscribing when it changes would be a loop rather than a correction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
