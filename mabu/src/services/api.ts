import type { RpcArgs, RpcName, RpcResult } from '@/domain/rpc';
import { GENERIC_FAILURE, isDomainError, type DomainErrorCode } from '@/domain/shared/errors';
import { config } from './config';
import { mockCall } from './mockServer';
import { useSession } from '@/store/session';

/** What a screen receives when a call fails: a stable code and a sentence a guest can read. */
export class ApiError extends Error {
  constructor(
    readonly code: DomainErrorCode | 'NETWORK' | 'UNKNOWN',
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function httpCall(name: string, args: unknown, token: string | null): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const key = (args as { idempotencyKey?: unknown } | undefined)?.idempotencyKey;
  if (typeof key === 'string') headers['Idempotency-Key'] = key;
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args ?? {}),
    });
  } catch {
    throw new ApiError(
      'NETWORK',
      'We cannot reach Mábu just now. Please check your connection, or call or email our reservations team.',
    );
  }
  const body = (await response.json().catch(() => ({}))) as {
    code?: DomainErrorCode;
    message?: string;
  };
  if (!response.ok) throw new ApiError(body.code ?? 'UNKNOWN', body.message ?? GENERIC_FAILURE);
  return body;
}

/**
 * The one way the app talks to the back end. Typed end to end from the
 * handler table, so a renamed field is a compile error, not a blank screen.
 */
export async function rpc<K extends RpcName>(
  name: K,
  ...rest: RpcArgs<K> extends undefined ? [args?: RpcArgs<K>] : [args: RpcArgs<K>]
): Promise<RpcResult<K>> {
  const args = rest[0];
  const { actor, token } = useSession.getState();
  try {
    const result = config.useMockApi
      ? await mockCall(name, args, actor)
      : await httpCall(name, args, token);
    return result as RpcResult<K>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isDomainError(error)) {
      if (error.detail) console.warn(`[api] ${name}: ${error.code} ${error.detail}`);
      throw new ApiError(error.code, error.message);
    }
    console.error(`[api] ${name} failed`, error);
    throw new ApiError('UNKNOWN', GENERIC_FAILURE);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : GENERIC_FAILURE;
}

export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

/**
 * Signing out on the device also ends the session on the server, so a
 * copied token stops working. Best effort: the device forgets it regardless.
 */
useSession.subscribe((state, previous) => {
  if (config.useMockApi || !previous.token || state.token) return;
  void httpCall('auth.signOut', {}, previous.token).catch(() => undefined);
});
