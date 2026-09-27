import type { IncomingMessage, ServerResponse } from 'node:http';
import { route } from './router';

/**
 * Adapter from Node's http request/response to route(). Used by the Vite dev
 * server (vite.config.ts) and by the Vercel function (api/[...path].ts).
 */

const MAX_BODY = 64 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  // Some hosts pre-read and pre-parse the body; recover the raw string.
  const pre = (req as IncomingMessage & { body?: unknown }).body;
  if (typeof pre === 'string') return Promise.resolve(pre);
  if (Buffer.isBuffer(pre)) return Promise.resolve(pre.toString('utf8'));

  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function clientIp(req: IncomingMessage): string {
  // On Vercel and most proxies the left-most x-forwarded-for entry is the client.
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}

export async function handleNode(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let rawBody: string;
  try {
    rawBody = req.method === 'GET' || req.method === 'HEAD' ? '' : await readBody(req);
  } catch {
    res.writeHead(413, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Request too large.' }));
    return;
  }

  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) headers[k] = Array.isArray(v) ? v.join(', ') : v;

  const out = await route({
    method: req.method ?? 'GET',
    path: url.pathname,
    query: url.searchParams,
    headers,
    ip: clientIp(req),
    rawBody,
  });

  const isText = typeof out.body === 'string';
  res.writeHead(out.status, {
    'Content-Type': isText ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...out.headers,
  });
  res.end(isText ? (out.body as string) : JSON.stringify(out.body));
}
