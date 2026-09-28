/**
 * The Mábu API: the same handler table the app's mock transport calls
 * (src/domain/rpc.ts), mounted at POST /rpc/<name> with real sign-in,
 * sessions, persistence and scheduled jobs.
 *
 * One process owns the data: calls run one at a time through a queue, and
 * each call's changed rows are written to the store before it answers.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createBackend, seedConfiguration, type Backend } from '../../src/domain/backend';
import { Database } from '../../src/domain/db';
import type { FeatureFlags } from '../../src/domain/flags';
import type { Actor } from '../../src/domain/guests/types';
import { ExpoPushProvider } from '../../src/domain/notifications/expoPush';
import type { NotificationProvider } from '../../src/domain/notifications/types';
import { createHandlers, type Handlers } from '../../src/domain/rpc';
import { DomainError, GENERIC_FAILURE, isDomainError } from '../../src/domain/shared/errors';
import type { Clock } from '../../src/domain/shared/clock';
import { Auth, type EmailSender } from './auth';
import type { ServerStore } from './store';

export interface ServerOptions {
  store: ServerStore;
  flags: FeatureFlags;
  /** Delivers sign-in codes and transactional email. Null: sign-in refuses. */
  email: EmailSender | null;
  /** Expo push; omit to leave push unconfigured. */
  push?: { fetch: typeof fetch; accessToken?: string };
  directInventory?: boolean;
  allowedOrigins?: string[];
  clock?: Clock;
  log?: (line: string) => void;
}

/** Handlers that only make sense against the in-app mock. */
const MOCK_ONLY = new Set(['admin.simulateFailure']);

const STATUS: Partial<Record<string, number>> = {
  VALIDATION: 400,
  POLICY_VIOLATION: 400,
  NOT_ELIGIBLE: 400,
  INSUFFICIENT_POINTS: 400,
  CONSENT_REQUIRED: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SLOT_UNAVAILABLE: 409,
  ALREADY_REDEEMED: 409,
  SOLD_OUT: 409,
  EXPIRED: 410,
  PAYMENT_DECLINED: 402,
  PAYMENT_PENDING: 202,
  RATE_LIMITED: 429,
  FEATURE_DISABLED: 503,
  NOT_CONFIGURED: 503,
  PROVIDER_UNAVAILABLE: 503,
};

const MAX_BODY = 100_000;

export interface MabuServer {
  backend: Backend;
  auth: Auth;
  /** Transport-free entry point: what the HTTP layer and the tests call. */
  call(
    name: string,
    args: unknown,
    token?: string,
    meta?: { ip?: string; idempotencyKey?: string },
  ): Promise<{ status: number; body: unknown }>;
  runJobs(): Promise<void>;
  handle(req: IncomingMessage, res: ServerResponse): void;
}

export async function createServer(options: ServerOptions): Promise<MabuServer> {
  const log = options.log ?? ((line: string) => console.log(line));
  const db = new Database();
  db.restore(await options.store.loadRows());
  db.drainChanges();

  // The push provider needs the service context, which createBackend makes;
  // so the backend gets forwarding providers, filled in just after.
  const providers: Partial<Record<'push' | 'email', NotificationProvider>> = {};
  const forward = (channel: 'push' | 'email'): NotificationProvider => ({
    channel,
    send: (message, rendered) =>
      providers[channel]
        ? providers[channel].send(message, rendered)
        : Promise.resolve({ accepted: false, reason: `${channel.toUpperCase()}_NOT_CONFIGURED` }),
  });
  const backend = createBackend({
    db,
    flags: options.flags,
    mode: 'live',
    clock: options.clock,
    directInventory: options.directInventory,
    channelProviders: { push: forward('push'), email: forward('email') },
  });
  if (options.push) {
    providers.push = new ExpoPushProvider(
      backend.ctx,
      options.push.fetch as never,
      options.push.accessToken,
    );
  }
  if (options.email) {
    const sender = options.email;
    providers.email = {
      channel: 'email',
      async send(message, rendered) {
        const guest = backend.db.guests.get(message.guestId);
        const to =
          (typeof message.data.toEmail === 'string' && message.data.toEmail) || guest?.email;
        if (!to) return { accepted: false, reason: 'NO_EMAIL_ADDRESS' };
        try {
          await sender.send(to, rendered.subject, rendered.body);
          return { accepted: true, providerMessageId: `email_${message.id}` };
        } catch (error) {
          return { accepted: false, reason: `email provider: ${String(error)}` };
        }
      },
    };
  }
  seedConfiguration(backend);
  await options.store.saveChanges(backend.db.drainChanges());

  const handlers: Handlers = createHandlers(backend);
  const auth = new Auth(options.store, options.email, () => backend.ctx.clock.now());

  // One call at a time: the service layer assumes it owns the data.
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const run = queue.then(work, work);
    queue = run.catch(() => undefined);
    return run;
  };

  const persist = async () => {
    const changes = backend.db.drainChanges();
    await options.store.saveChanges(changes);
  };

  async function actorFor(token?: string): Promise<Actor | null> {
    const guestId = await auth.resolve(token);
    if (!guestId) return null;
    const guest = backend.db.guests.get(guestId);
    return guest ? { id: guest.id, role: guest.role } : null;
  }

  async function dispatch(
    name: string,
    args: Record<string, unknown>,
    token: string | undefined,
    ip: string,
  ): Promise<unknown> {
    if (name === 'auth.requestCode') {
      await auth.requestCode(String(args.email ?? ''), ip);
      return { sent: true };
    }
    if (name === 'auth.verifyCode') {
      await auth.verifyCode(String(args.email ?? ''), String(args.code ?? ''));
      const guest = backend.guests.findOrCreate({
        email: String(args.email).trim(),
        name: typeof args.name === 'string' ? args.name : undefined,
        phone: typeof args.phone === 'string' ? args.phone : undefined,
        referralCode: typeof args.referralCode === 'string' ? args.referralCode : undefined,
      } as never);
      if (typeof args.name === 'string' && args.name.trim() && !guest.name)
        backend.db.guests.update(guest.id, { name: args.name.trim() });
      const fresh = backend.db.guests.require(guest.id);
      const session = await auth.createSession(fresh.id);
      return { guest: fresh, token: session, actor: { id: fresh.id, role: fresh.role } };
    }
    if (name === 'auth.signOut') {
      await auth.endSession(token);
      return { signedOut: true };
    }
    if (MOCK_ONLY.has(name) || !Object.prototype.hasOwnProperty.call(handlers, name)) {
      throw new DomainError('NOT_FOUND', 'We could not find that.', `rpc ${name}`);
    }
    const actor = await actorFor(token);
    const handler = handlers[name as keyof Handlers] as (
      actor: Actor | null,
      args: unknown,
    ) => Promise<unknown>;
    return handler(actor, args);
  }

  async function call(
    name: string,
    rawArgs: unknown,
    token?: string,
    meta: { ip?: string; idempotencyKey?: string } = {},
  ): Promise<{ status: number; body: unknown }> {
    const args: Record<string, unknown> =
      rawArgs && typeof rawArgs === 'object' ? { ...(rawArgs as Record<string, unknown>) } : {};
    if (meta.idempotencyKey && args.idempotencyKey === undefined)
      args.idempotencyKey = meta.idempotencyKey;
    return exclusive(async () => {
      try {
        const result = await dispatch(name, args, token, meta.ip ?? 'unknown');
        return { status: 200, body: result ?? {} };
      } catch (error) {
        if (isDomainError(error)) {
          // Signed out, or a token that is not a live session: 401, so the
          // app can ask the guest to sign in again.
          const status =
            error.code === 'FORBIDDEN' && !(await auth.resolve(token))
              ? 401
              : (STATUS[error.code] ?? 400);
          if (error.detail) log(`[rpc] ${name} ${error.code}: ${error.detail}`);
          return { status, body: { code: error.code, message: error.message } };
        }
        log(`[rpc] ${name} failed: ${error instanceof Error ? error.stack : String(error)}`);
        return { status: 500, body: { code: 'UNKNOWN', message: GENERIC_FAILURE } };
      } finally {
        // Whatever the outcome, what was written is kept — a failed payment
        // still records its attempt. A store failure is loud, not silent.
        await persist().catch((e) => log(`[store] write failed: ${String(e)}`));
      }
    });
  }

  function cors(req: IncomingMessage, res: ServerResponse) {
    const origin = req.headers.origin;
    if (origin && options.allowedOrigins?.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    }
  }

  function send(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(body));
  }

  function handle(req: IncomingMessage, res: ServerResponse) {
    cors(req, res);
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      send(res, 200, { ok: true, service: 'mabu-api' });
      return;
    }
    const match = /^\/rpc\/([a-zA-Z0-9.]+)$/.exec(url.pathname);
    if (req.method !== 'POST' || !match) {
      send(res, 404, { code: 'NOT_FOUND', message: 'Not found.' });
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY && !aborted) {
        aborted = true;
        send(res, 413, { code: 'VALIDATION', message: 'That request is too large.' });
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted) return;
      let args: unknown = {};
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        args = raw ? JSON.parse(raw) : {};
      } catch {
        send(res, 400, { code: 'VALIDATION', message: 'That request could not be read.' });
        return;
      }
      const auth = req.headers.authorization;
      const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
      const key = req.headers['idempotency-key'];
      const ip =
        (typeof req.headers['x-forwarded-for'] === 'string'
          ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
          : undefined) ??
        req.socket.remoteAddress ??
        'unknown';
      void call(match[1]!, args, token, {
        ip,
        idempotencyKey: typeof key === 'string' ? key : undefined,
      }).then(({ status, body }) => send(res, status, body));
    });
  }

  return {
    backend,
    auth,
    call,
    handle,
    runJobs: () =>
      exclusive(async () => {
        try {
          await backend.runJobs();
        } finally {
          await persist();
        }
      }),
  };
}
