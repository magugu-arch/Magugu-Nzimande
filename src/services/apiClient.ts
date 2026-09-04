import { config } from '@/constants/config';
import type { ApiError } from '@/types';
import { reportError, scrub } from '@/ux/errorReporting';
import { clearTokens, getAccessToken, getRefreshToken, storeTokens } from './secureStorage';
import { MalformedResponse } from './wireChecks';

/**
 * Thin typed fetch wrapper.
 *
 * Every service goes through here so auth headers, timeouts and error
 * normalisation exist in exactly one place. Swapping REST for GraphQL later
 * means rewriting this file, not every caller.
 */

/**
 * Whether a failure means "that thing is not there" rather than "we could not
 * ask".
 *
 * The product screen answered both with "It may have come off the menu", which
 * is true for the first and a fabrication for the second — it told customers
 * the item was delisted when the app had simply failed to reach the server.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404;
}

/**
 * The "that thing is not there" failure, in the shape `isNotFound` reads.
 *
 * This exists because the mock was failing differently from the world. The
 * mock product lookup threw `Object.assign(new Error(…), { code: 'not_found' })`
 * and the mock promotion lookup threw a bare `Error` — neither of which
 * `isNotFound` can recognise, because neither carries a status. So against the
 * real API a delisted item read as delisted, and against the mock the identical
 * situation read as a broken app. The mock build is every preview, every demo
 * and every screenshot, which means the "We can't find that item" copy was
 * written, styled, reviewed, and unreachable.
 *
 * A mock that fails in its own private way leaves the branch written for the
 * real failure untested. Services construct their not-found through here so
 * there is one shape, and it is the server's.
 */
export function notFound(message: string, code = 'not_found'): ApiRequestError {
  return new ApiRequestError({ code, message, status: 404 });
}

/**
 * The machine-readable half of a failure, for the screens that branch on it.
 *
 * Screens must never branch on `error.message`: it is the sentence shown to
 * the customer, so rewording the copy would silently change which branch runs.
 * `undefined` for anything that is not one of ours.
 */
export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiRequestError ? error.code : undefined;
}

/**
 * Whether a failure leaves the app not knowing what the server did.
 *
 * A 400 or a 422 is an answer: the server received the request, considered it,
 * and refused. A timeout, a dropped connection or a 5xx is not — the request
 * may have been received and acted on, and only the reply was lost.
 *
 * The distinction matters in exactly one place and matters a great deal there.
 * `submitOrder` treats a thrown authorisation as "nothing was authorised, so
 * retrying is free", which is true of a decline and false of a timeout. A
 * gateway that authorised the card and could not tell us in time, followed by
 * a customer being invited to try again, is two holds on one order — the
 * outcome the whole authorise-then-place sequence exists to prevent.
 */
export function didNotHearBack(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return false;
  if (error.code === 'timeout' || error.code === 'network') return true;
  return error.status !== undefined && error.status >= 500;
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number | undefined;
  readonly fieldErrors: Record<string, string> | undefined;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.code = error.code;
    this.status = error.status;
    this.fieldErrors = error.fieldErrors;
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      ...(this.status !== undefined ? { status: this.status } : {}),
      ...(this.fieldErrors !== undefined ? { fieldErrors: this.fieldErrors } : {}),
    };
  }
}

export interface RequestOptions<T = unknown> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Extra headers merged over the defaults. */
  headers?: Record<string, string>;
  /** Skips the Authorization header (sign-in, register, refresh). */
  anonymous?: boolean;
  signal?: AbortSignal;
  /**
   * Checks the parsed body before the caller is handed it.
   *
   * Optional, and the endpoints that pass one are the ones where a value the
   * app cannot read becomes a number a customer acts on — prices, totals,
   * balances, coordinates. Without it the line below is a cast: `T` is a
   * promise about the wire that nothing keeps. See `wireChecks`.
   */
  parse?: (value: unknown) => T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function parseError(response: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON error body — fall through to the generic message below.
  }

  if (isRecord(payload)) {
    return {
      code: typeof payload.code === 'string' ? payload.code : `http_${response.status}`,
      message:
        typeof payload.message === 'string'
          ? payload.message
          : 'Something went wrong. Please try again.',
      status: response.status,
      ...(isRecord(payload.fieldErrors)
        ? { fieldErrors: payload.fieldErrors as Record<string, string> }
        : {}),
    };
  }

  return {
    code: `http_${response.status}`,
    message:
      response.status >= 500
        ? 'Our kitchen is having a moment. Please try again shortly.'
        : 'Something went wrong. Please try again.',
    status: response.status,
  };
}

/**
 * Expired-session handling.
 *
 * The refresh token has been written to the keychain on every sign-in since
 * the beginning and was never once read back: `getRefreshToken` had no
 * callers, and a 401 was parsed into the same "Something went wrong" as a 500.
 * Against a real backend that means the moment the access token expires, every
 * screen shows an error, the app still believes it is signed in, and the only
 * way out is finding Sign out in the account menu.
 */

type SessionExpiredHandler = () => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;

/**
 * Called once when refreshing fails and the customer has to sign in again.
 * The app registers a handler that clears local auth state and routes to
 * sign-in; keeping it a callback stops this module from importing a store.
 */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler;
}

/**
 * The refresh currently in progress, if any.
 *
 * Queries fail in bunches — open the app on a stale token and the menu, the
 * loyalty balance and the active order all 401 within the same tick. Without
 * this, each would start its own refresh, and a backend that rotates refresh
 * tokens would invalidate the other two mid-flight. One refresh, everyone
 * waits for it.
 */
let refreshInFlight: Promise<string | null> | null = null;

function isRefreshResponse(value: unknown): value is { accessToken: string; refreshToken: string } {
  return (
    isRecord(value) &&
    typeof value.accessToken === 'string' &&
    value.accessToken.length > 0 &&
    typeof value.refreshToken === 'string' &&
    value.refreshToken.length > 0
  );
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    // A bare fetch, not `request`: the refresh call must never be subject to
    // the 401 handling below, or a rejected refresh would try to refresh
    // itself.
    const response = await fetch(`${config.apiBaseUrl}/v1/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const payload: unknown = await response.json();
    if (!isRefreshResponse(payload)) return null;

    await storeTokens(payload.accessToken, payload.refreshToken);
    return payload.accessToken;
  } catch {
    // A refresh that cannot reach the server is not an expired session — but
    // the caller's original request has already failed, so there is nothing
    // to retry with either.
    return null;
  }
}

function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** Test seam: forget any in-flight refresh between cases. */
export function resetSessionState(): void {
  refreshInFlight = null;
  sessionExpiredHandler = null;
}

export async function request<T>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  return execute<T>(path, options, true);
}

async function execute<T>(
  path: string,
  options: RequestOptions<T>,
  mayRefresh: boolean,
): Promise<T> {
  const { method = 'GET', body, headers = {}, anonymous = false, signal, parse } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.apiTimeoutMs);
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...headers,
  };

  if (!anonymous) {
    const token = await getAccessToken();
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers: requestHeaders,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    if (response.status === 401 && !anonymous) {
      clearTimeout(timeout);

      /**
       * A 401 on a request that carried no token is not an expired session.
       *
       * A guest has never signed in, so there is nothing to refresh and
       * nothing to clear — and treating it as an expiry does real damage. The
       * expiry handler forgets the customer: it empties the basket, drops the
       * delivery address and routes to sign-in. A guest who browsed, built an
       * order and pressed pay would lose the lot and be told "Your session has
       * expired", which they would have every right to find baffling, never
       * having had one.
       *
       * Whether a guest may order at all is a decision for the backend and the
       * business. Whichever way it goes, this is the wrong way to say no.
       */
      if (!requestHeaders.Authorization) {
        throw new ApiRequestError({
          code: 'sign_in_required',
          message: 'Sign in to finish this.',
          status: 401,
        });
      }

      // One attempt, then give up. `mayRefresh` is false on the retry, so a
      // token that is refused immediately after being minted ends the session
      // rather than looping.
      if (mayRefresh && (await refreshAccessToken())) {
        return execute<T>(path, options, false);
      }

      await clearTokens();
      sessionExpiredHandler?.();

      throw new ApiRequestError({
        code: 'session_expired',
        message: 'Your session has expired. Please sign in again.',
        status: 401,
      });
    }

    if (!response.ok) {
      throw new ApiRequestError(await parseError(response));
    }

    if (response.status === 204) return undefined as T;

    const payload: unknown = await response.json();
    // Without `parse` this is the cast it always was.
    return parse ? parse(payload) : (payload as T);
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;

    /**
     * A response the app cannot read is not a network failure.
     *
     * Reported as its own code so it is distinguishable in logs from a real
     * outage — this one means the backend and the app disagree about a shape,
     * and somebody has to change one of them. `detail` names the exact field
     * and what arrived, which is the difference between a five-minute fix and
     * an afternoon. What the customer is told is the same either way: the app
     * could not load it, which is true, rather than a number it made up.
     */
    if (error instanceof MalformedResponse) {
      /**
       * The customer gets the honest generic; whoever has to fix it gets the
       * field name and what actually arrived — scrubbed.
       *
       * "What actually arrived" is the response body, and the endpoints most
       * likely to disagree about a shape are the ones carrying accounts,
       * addresses and orders. This line was printing that verbatim, and `path`
       * can carry a query string. §13 asks for operational errors without
       * leaking customer information; the diagnostic value is in the field
       * name, which survives scrubbing intact.
       */
      reportError(error, { scope: `api.malformed:${scrub(path)}` });
      throw new ApiRequestError({
        code: 'malformed_response',
        message: "We couldn't read that. Please try again.",
        status: 200,
      });
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiRequestError({
        code: 'timeout',
        message: 'That took too long. Check your connection and try again.',
      });
    }

    throw new ApiRequestError({
      code: 'network',
      message: "We can't reach bb.q right now. Check your connection and try again.",
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Simulated latency so mock-mode UI exercises real loading states. */
export function delay<T>(value: T, ms = 320): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
