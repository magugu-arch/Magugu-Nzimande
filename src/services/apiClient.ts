import { config } from '@/constants/config';
import type { ApiError } from '@/types';
import { getAccessToken } from './secureStorage';

/**
 * Thin typed fetch wrapper.
 *
 * Every service goes through here so auth headers, timeouts and error
 * normalisation exist in exactly one place. Swapping REST for GraphQL later
 * means rewriting this file, not every caller.
 */

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

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Extra headers merged over the defaults. */
  headers?: Record<string, string>;
  /** Skips the Authorization header (sign-in, register, refresh). */
  anonymous?: boolean;
  signal?: AbortSignal;
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

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, anonymous = false, signal } = options;

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

    if (!response.ok) {
      throw new ApiRequestError(await parseError(response));
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;

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
