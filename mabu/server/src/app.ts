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
import { Auth, FRESH_SESSION_MS, type EmailSender } from './auth';
import {
  clientIp,
  deviceLabel,
  guardJson,
  MAX_BODY_BYTES,
  RateLimiter,
  requestId,
  securityHeaders,
} from './security';
import type { PayFastProvider } from './payfast';
import type { ServerStore, SessionRecord } from './store';

export interface ServerOptions {
  store: ServerStore;
  flags: FeatureFlags;
  /** Delivers sign-in codes and transactional email. Null: sign-in refuses. */
  email: EmailSender | null;
  /** Expo push; omit to leave push unconfigured. */
  push?: { fetch: typeof fetch; accessToken?: string };
  directInventory?: boolean;
  /** PayFast hosted checkout; `validate` asks PayFast to confirm an ITN. */
  payfast?: {
    provider: PayFastProvider;
    validate: (host: string, body: string) => Promise<boolean>;
  };
  allowedOrigins?: string[];
  /** This server's public origin; https turns on HSTS. */
  publicUrl?: string;
  /** Salt for the address hash kept with a session. Set it to survive restarts. */
  ipSalt?: string;
  rateLimit?: { perIpPerMinute?: number; perSessionPerMinute?: number };
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
  REAUTH_REQUIRED: 403,
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

const MAX_BODY = MAX_BODY_BYTES;

export interface MabuServer {
  backend: Backend;
  auth: Auth;
  /** Transport-free entry point: what the HTTP layer and the tests call. */
  call(
    name: string,
    args: unknown,
    token?: string,
    meta?: { ip?: string; idempotencyKey?: string; label?: string },
  ): Promise<{ status: number; body: unknown; retryAfter?: number }>;
  runJobs(): Promise<void>;
  handle(req: IncomingMessage, res: ServerResponse): void;
  /** The PayFast pages and webhook, without HTTP (tests). */
  payfast: {
    page(intentId: string, outcome?: string): Promise<{ status: number; html: string }>;
    notify(raw: string): Promise<number>;
  };
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
    paymentProvider: options.payfast?.provider,
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
  const auth = new Auth(
    options.store,
    options.email,
    () => backend.ctx.clock.now(),
    options.ipSalt,
    // A session's life follows the role the guest holds now, not the one they
    // held when they signed in: promoting someone to staff shortens it at once.
    (guestId) => backend.db.guests.get(guestId)?.role ?? 'guest',
  );

  /**
   * How much any one caller may ask for. Sign-in has its own tighter limits
   * (see Auth); this stops a script from hammering everything else.
   */
  const perIp = new RateLimiter(options.rateLimit?.perIpPerMinute ?? 240, 60_000);
  const perSession = new RateLimiter(options.rateLimit?.perSessionPerMinute ?? 120, 60_000);

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

  async function actorFor(
    token?: string,
  ): Promise<{ actor: Actor; session: SessionRecord } | null> {
    const session = await auth.resolve(token);
    if (!session) return null;
    const guest = backend.db.guests.get(session.guestId);
    if (!guest) return null;
    // The role comes from the guest record now, not from what the session was
    // opened with: a role taken away takes effect on the next call.
    return { actor: { id: guest.id, role: guest.role }, session };
  }

  /**
   * Changing money, policy or someone else's points needs a sign-in from the
   * last half hour, so an unattended staff device cannot be used to do it.
   *
   * Redeeming a voucher is deliberately not here: front of house does it at
   * the table all evening, and it needs the guest's own code. Cancelling one
   * is here, because that refunds the purchaser and needs no code.
   */
  const NEEDS_FRESH_SIGN_IN = new Set([
    'admin.policy.update',
    'admin.adjust',
    'admin.reverse',
    'admin.rule.save',
    'admin.reward.save',
    'admin.rewardsSettings.save',
    'admin.template.save',
    'admin.vouchers.cancel',
    'admin.vouchers.policy',
    'admin.payments.settle',
    'admin.campaign.schedule',
    'admin.menu.saveDish',
    'admin.menu.saveWine',
  ]);
  // A name that does not exist can never be dispatched, so a typo here would
  // silently switch the rule off. Refuse to start instead.
  for (const name of NEEDS_FRESH_SIGN_IN) {
    if (!Object.prototype.hasOwnProperty.call(handlers, name)) {
      throw new Error(`NEEDS_FRESH_SIGN_IN names a handler that does not exist: ${name}`);
    }
  }

  async function dispatch(
    name: string,
    args: Record<string, unknown>,
    token: string | undefined,
    ip: string,
    label: string,
  ): Promise<unknown> {
    if (name === 'auth.requestCode') {
      await auth.requestCode(String(args.email ?? ''), ip);
      return { sent: true };
    }
    if (name === 'auth.verifyCode') {
      await auth.verifyCode(String(args.email ?? ''), String(args.code ?? ''), ip);
      const guest = backend.guests.findOrCreate({
        email: String(args.email).trim(),
        name: typeof args.name === 'string' ? args.name : undefined,
        phone: typeof args.phone === 'string' ? args.phone : undefined,
        referralCode: typeof args.referralCode === 'string' ? args.referralCode : undefined,
      } as never);
      if (typeof args.name === 'string' && args.name.trim() && !guest.name)
        backend.db.guests.update(guest.id, { name: args.name.trim() });
      const fresh = backend.db.guests.require(guest.id);
      const { token: issued, newDevice } = await auth.createSession(fresh.id, {
        role: fresh.role,
        label,
        ip,
      });
      if (newDevice) await auth.alertNewSignIn(fresh.email, label, backend.ctx.clock.now());
      return { guest: fresh, token: issued, actor: { id: fresh.id, role: fresh.role } };
    }
    if (name === 'auth.signOut') {
      await auth.endSession(token);
      return { signedOut: true };
    }
    if (name === 'auth.sessions') {
      const me = await actorFor(token);
      if (!me) throw new DomainError('FORBIDDEN', 'Please sign in to continue.', 'anonymous');
      return { sessions: await auth.sessions(me.actor.id, token) };
    }
    if (name === 'auth.signOutOthers' || name === 'auth.signOutAll') {
      const me = await actorFor(token);
      if (!me) throw new DomainError('FORBIDDEN', 'Please sign in to continue.', 'anonymous');
      const keep = name === 'auth.signOutOthers' ? token : undefined;
      const revoked = await auth.revoke(me.actor.id, keep);
      backend.db.audit.insert({
        id: backend.ctx.ids.id('aud'),
        actorId: me.actor.id,
        actorRole: me.actor.role,
        action: name === 'auth.signOutOthers' ? 'session.revoked-others' : 'session.revoked-all',
        entityType: 'guest',
        entityId: me.actor.id,
        at: backend.ctx.clock.now().toISOString(),
        detail: { revoked },
      });
      return { revoked };
    }
    if (MOCK_ONLY.has(name) || !Object.prototype.hasOwnProperty.call(handlers, name)) {
      throw new DomainError('NOT_FOUND', 'We could not find that.', `rpc ${name}`);
    }
    const me = await actorFor(token);
    if (me && NEEDS_FRESH_SIGN_IN.has(name)) {
      const age = backend.ctx.clock.now().getTime() - new Date(me.session.createdAt).getTime();
      if (age > FRESH_SESSION_MS) {
        throw new DomainError(
          'REAUTH_REQUIRED',
          'Please sign in again to make this change.',
          `stale session for ${name}`,
        );
      }
    }
    const handler = handlers[name as keyof Handlers] as (
      actor: Actor | null,
      args: unknown,
    ) => Promise<unknown>;
    return handler(me?.actor ?? null, args);
  }

  async function call(
    name: string,
    rawArgs: unknown,
    token?: string,
    meta: { ip?: string; idempotencyKey?: string; label?: string } = {},
  ): Promise<{ status: number; body: unknown; retryAfter?: number }> {
    const ip = meta.ip ?? 'unknown';
    const label = meta.label ?? 'Unknown device';
    const at = Date.now();
    const wait = perIp.check(ip, at) ?? (token ? perSession.check(token.slice(0, 24), at) : null);
    if (wait !== null) {
      return {
        status: 429,
        retryAfter: wait,
        body: {
          code: 'RATE_LIMITED',
          message: 'That is a lot of requests. Please wait a moment and try again.',
        },
      };
    }
    const args: Record<string, unknown> =
      rawArgs && typeof rawArgs === 'object' ? { ...(rawArgs as Record<string, unknown>) } : {};
    if (meta.idempotencyKey && args.idempotencyKey === undefined)
      args.idempotencyKey = meta.idempotencyKey;
    return exclusive(async () => {
      try {
        const result = await dispatch(name, args, token, ip, label);
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

  const https = (options.publicUrl ?? '').startsWith('https://');

  function send(res: ServerResponse, status: number, body: unknown, retryAfter?: number) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      ...securityHeaders({ https, kind: 'json' }),
      ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}),
    });
    res.end(JSON.stringify(body));
  }

  function sendHtml(res: ServerResponse, status: number, html: string) {
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      ...securityHeaders({
        https,
        kind: 'page',
        // The payment page posts to PayFast and nowhere else.
        formAction: options.payfast ? [options.payfast.provider.host] : [],
      }),
    });
    res.end(html);
  }

  function readBody(req: IncomingMessage, res: ServerResponse, done: (raw: string) => void) {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        res.writeHead(413);
        res.end();
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (size <= MAX_BODY) done(Buffer.concat(chunks).toString('utf8'));
    });
  }

  const notice = (title: string, body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mábu · ${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0B0B;color:#E8E1D6;font-family:Helvetica,Arial,sans-serif;text-align:center;padding:24px">
<div><div style="font-family:Georgia,serif;letter-spacing:6px;color:#C9A35B;font-size:24px">MÁBU</div><h1 style="font-family:Georgia,serif;font-weight:normal">${title}</h1><p style="max-width:420px">${body}</p>
<a href="mabu://profile" style="display:inline-block;margin-top:16px;background:#C9A35B;color:#0B0B0B;border-radius:999px;padding:14px 28px;text-decoration:none;font-weight:600">Back to the Mábu app</a></div></body></html>`;

  /** The page that hands the guest to PayFast, and the pages they come back to. */
  async function payPage(intentId: string, outcome?: string) {
    const payfast = options.payfast;
    const intent = backend.db.payments.get(intentId);
    if (!payfast || !intent) {
      return {
        status: 404,
        html: notice('Payment not found', 'Please return to the app and try again.'),
      };
    }
    if (outcome === 'done') {
      return {
        status: 200,
        html: notice(
          'Thank you',
          'Your payment is being confirmed. The app updates the moment it is — usually within a minute.',
        ),
      };
    }
    if (outcome === 'cancelled') {
      return { status: 200, html: notice('Payment cancelled', 'Nothing was charged.') };
    }
    if (intent.status !== 'pending') {
      return { status: 200, html: notice('Already settled', 'This payment is already complete.') };
    }
    const payerId = backend.payments.payerOf(intent);
    const payer = payerId ? backend.db.guests.get(payerId) : undefined;
    const itemName =
      intent.purpose === 'voucher'
        ? 'Mábu gift voucher'
        : intent.purpose === 'event'
          ? 'Mábu event ticket'
          : 'Mábu booking deposit';
    const fields = payfast.provider.checkoutFields({
      intentId,
      amountCents: intent.amountCents,
      itemName,
      email: payer?.email,
      firstName: payer?.name?.split(' ')[0],
    });
    return { status: 200, html: payfast.provider.checkoutPage(fields) };
  }

  /** PayFast's ITN: verified, then settled through the one queue. Always answers quickly. */
  async function payfastNotification(raw: string): Promise<number> {
    const payfast = options.payfast;
    if (!payfast) return 404;
    const fields = [...new URLSearchParams(raw).entries()] as [string, string][];
    const verdict = await payfast.provider.verifyNotification(fields, payfast.validate);
    if (!verdict.ok) {
      log(`[payfast] ITN refused: ${verdict.reason}`);
      return 400;
    }
    if (verdict.status === 'pending') return 200;
    const status = verdict.status;
    return exclusive(async () => {
      try {
        await backend.payments.settleFromGateway(verdict.intentId, {
          status,
          amountCents: verdict.amountCents,
          providerRef: verdict.providerRef,
        });
        return 200;
      } catch (error) {
        log(`[payfast] ITN for ${verdict.intentId} not settled: ${String(error)}`);
        return 400;
      } finally {
        await persist().catch((e) => log(`[store] write failed: ${String(e)}`));
      }
    });
  }

  function handle(req: IncomingMessage, res: ServerResponse) {
    // A short id ties a log line to one request without naming the caller.
    res.setHeader('X-Request-Id', requestId());
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
    const pay = /^\/pay\/([\w-]+)(?:\/(done|cancelled))?$/.exec(url.pathname);
    if (req.method === 'GET' && pay) {
      void payPage(pay[1]!, pay[2]).then(({ status, html }) => sendHtml(res, status, html));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/webhooks/payfast') {
      readBody(req, res, (raw) => {
        void payfastNotification(raw).then((status) => {
          res.writeHead(status);
          res.end();
        });
      });
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
        // Legal JSON can still be hostile: nested, huge, or carrying
        // __proto__. The guard refuses it before anything else sees it.
        args = raw ? guardJson(JSON.parse(raw)) : {};
      } catch {
        send(res, 400, { code: 'VALIDATION', message: 'That request could not be read.' });
        return;
      }
      const header = req.headers.authorization;
      const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
      const key = req.headers['idempotency-key'];
      const ip = clientIp(req.headers, req.socket.remoteAddress);
      void call(match[1]!, args, token, {
        ip,
        label: deviceLabel(req.headers['user-agent']),
        idempotencyKey: typeof key === 'string' ? key : undefined,
      }).then(({ status, body, retryAfter }) => send(res, status, body, retryAfter));
    });
  }

  return {
    backend,
    auth,
    call,
    handle,
    payfast: { page: payPage, notify: payfastNotification },
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
