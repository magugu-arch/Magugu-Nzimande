import type { IncomingMessage, ServerResponse } from 'node:http';
import { isAdapterError, type AdapterErrorKind } from '../../src/core/adapters/errors';

/** AdapterError kinds as HTTP statuses: the inverse of the app's live client. */
export const STATUS: Record<AdapterErrorKind, number> = {
  unauthorised: 401,
  forbidden: 403,
  'not-found': 404,
  conflict: 409,
  invalid: 422,
  unavailable: 503,
  offline: 503,
  'not-configured': 501,
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly kind: string,
    message?: string,
  ) {
    super(message ?? kind);
  }
}

export function cors(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-NMU-Role');
  res.setHeader('Access-Control-Max-Age', '600');
}

export function send(res: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.writeHead(status === 200 ? 204 : status);
    res.end();
    return;
  }
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

export function html(res: ServerResponse, status: number, page: string): void {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(page);
}

export function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

export async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 64 * 1024) throw new HttpError(413, 'invalid', 'Body too large');
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid', 'Body is not JSON');
  }
}

export function fail(res: ServerResponse, e: unknown): number {
  if (e instanceof HttpError) {
    send(res, e.status, { error: e.kind, message: e.message });
    return e.status;
  }
  if (isAdapterError(e)) {
    const status = STATUS[e.kind];
    send(res, status, { error: e.kind, message: e.message });
    return status;
  }
  console.error(e);
  send(res, 500, { error: 'unavailable', message: 'Unexpected error' });
  return 500;
}
