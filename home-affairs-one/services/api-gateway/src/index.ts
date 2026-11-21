/**
 * Client gateway.
 *
 * The channel apps never call a service directly. Every call goes through here
 * and gets the same treatment the brief asks for on any external call:
 *
 *   timeout · retry with back-off · idempotency · correlation ID ·
 *   safe error mapping · audit · observability
 *
 * In the prototype the services behind it are in-browser mocks. In a real build
 * this file becomes an HTTP client for the API gateway and the mocks go away;
 * the apps keep the same `Gateway` shape.
 */
import type {
  AppointmentsPort,
  AuditEvent,
  AuditPort,
  CaseEvent,
  CataloguePort,
  IdentityPort,
  NotificationsPort,
  PaymentsPort,
  SupportPort,
  WhatsAppPort,
  WorkflowPort,
} from '@hao/api-contracts';
import { createWorkflowService } from '@hao/application-workflow';
import { createAppointmentsService } from '@hao/appointments';
import { createAuditService } from '@hao/audit-service';
import { createIdentityService } from '@hao/identity-adapter';
import { TOPICS, type Platform } from '@hao/local-platform';
import { createNotificationsService } from '@hao/notifications';
import { createPaymentsService } from '@hao/payments-adapter';
import { createCatalogueService } from '@hao/service-catalogue';
import { GatewayError, isGatewayError, type ErrorCategory, type Role } from '@hao/shared-types';
import { createSupportService } from '@hao/support-desk';
import { createWhatsAppService } from '@hao/whatsapp-adapter';

/* ------------------------------------------------------------------ */
/* Public shape                                                        */
/* ------------------------------------------------------------------ */

export interface Gateway {
  readonly identity: IdentityPort;
  readonly catalogue: CataloguePort;
  readonly workflow: WorkflowPort;
  readonly appointments: AppointmentsPort;
  readonly payments: PaymentsPort;
  readonly notifications: NotificationsPort;
  readonly whatsapp: WhatsAppPort;
  readonly support: SupportPort;
  readonly audit: AuditPort;
  readonly platform: Platform;
  /** Who is making calls. Audit events carry this opaque reference, never a name. */
  setActor(actor: GatewayActor | null): void;
  /** Resolves when event-driven work (notifications fan-out) has finished. */
  whenIdle(): Promise<void>;
}

export interface GatewayActor {
  role: Role;
  /** Opaque token: person token, staff ref or partner ref. */
  ref: string;
}

export interface GatewayOptions {
  /** Per-call timeout. Default 8 seconds. */
  timeoutMs?: number;
  /** Retries after the first attempt, for retryable failures. Default 2. */
  maxRetries?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** Published on the bus (`TOPICS.gatewayCall`) after every call. Contains no arguments or results. */
export interface GatewayCallRecord {
  correlationId: string;
  service: string;
  method: string;
  kind: 'read' | 'mutation';
  outcome: 'ok' | 'error';
  category: ErrorCategory | null;
  attempts: number;
  durationMs: number;
  /** True when an idempotency key matched and the stored result was returned. */
  replayed: boolean;
}

/* ------------------------------------------------------------------ */
/* Policy helpers                                                      */
/* ------------------------------------------------------------------ */

const READ_PREFIXES = ['get', 'list', 'search'];
export const isReadMethod = (method: string) => READ_PREFIXES.some((p) => method.startsWith(p));

/** Mutations that legitimately carry no idempotency key. */
const KEYLESS_MUTATIONS = new Set(['audit.record']);

const IDEMPOTENCY_STORE_KEY = 'gateway.idempotency';
const IDEMPOTENCY_LIMIT = 200;
const SLOW_LATENCY_MS = 2400;
const OPAQUE_REF = /^[A-Z][A-Z-]*-DEMO-[A-Z0-9]+$/;

interface StoredResult {
  result: unknown;
  at: number;
}

function findIdempotencyKey(args: unknown[]): string | null {
  const last = args[args.length - 1];
  if (last && typeof last === 'object' && 'idempotencyKey' in last) {
    const key = (last as { idempotencyKey: unknown }).idempotencyKey;
    if (typeof key === 'string' && key.length > 0) return key;
  }
  return null;
}

/** The first argument that is an opaque demo token: what the call was about. */
function findResourceRef(args: unknown[]): string {
  for (const arg of args) {
    if (typeof arg === 'string' && OPAQUE_REF.test(arg)) return arg;
    if (arg && typeof arg === 'object') {
      for (const value of Object.values(arg)) {
        if (typeof value === 'string' && OPAQUE_REF.test(value)) return value;
      }
    }
  }
  return 'UNSPECIFIED';
}

const CHANNEL_FOR_ROLE: Record<Role | 'system', AuditEvent['channel']> = {
  citizen: 'WEB',
  staff: 'STAFF_CONSOLE',
  partner: 'PARTNER_API',
  system: 'SYSTEM',
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let correlationCounter = 0;

/**
 * `CORR-MX0A-1B2C-0001`: time in base 36 and a counter, in groups of four.
 * Grouping matters: the audit trail refuses anything with a long run of digits
 * (it could be an identity or phone number), and an ungrouped timestamp will
 * sometimes be all digits. A refused audit write must never be the reason a
 * record is missing.
 */
export function nextCorrelationId(now: Date): string {
  correlationCounter = (correlationCounter % 9999) + 1;
  const time = now.getTime().toString(36).toUpperCase().padStart(8, '0');
  const groups = time.match(/.{1,4}/g) ?? [time];
  return `CORR-${groups.join('-')}-${String(correlationCounter).padStart(4, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Gateway                                                             */
/* ------------------------------------------------------------------ */

export interface CallPolicyDeps {
  platform: Platform;
  /** The raw audit service (never the wrapped one). */
  audit: AuditPort;
  getActor: () => GatewayActor | null;
  timeoutMs: number;
  maxRetries: number;
  sleep: (ms: number) => Promise<void>;
}

/**
 * The policy applied to every adapter call. Exported so it can be tested
 * against a fake port; `createGateway` is the only production caller.
 */
export function createCallPolicy(deps: CallPolicyDeps) {
  const { platform, audit, getActor, timeoutMs, maxRetries, sleep } = deps;

  function readIdempotent(key: string): StoredResult | undefined {
    return platform.store.get<Record<string, StoredResult>>(IDEMPOTENCY_STORE_KEY)?.[key];
  }

  function writeIdempotent(key: string, result: unknown) {
    const all = platform.store.get<Record<string, StoredResult>>(IDEMPOTENCY_STORE_KEY) ?? {};
    all[key] = { result, at: platform.clock.now().getTime() };
    const keys = Object.keys(all);
    if (keys.length > IDEMPOTENCY_LIMIT) {
      keys
        .sort((a, b) => (all[a]?.at ?? 0) - (all[b]?.at ?? 0))
        .slice(0, keys.length - IDEMPOTENCY_LIMIT)
        .forEach((old) => delete all[old]);
    }
    platform.store.set(IDEMPOTENCY_STORE_KEY, all);
  }

  async function recordAudit(
    service: string,
    method: string,
    args: unknown[],
    outcome: AuditEvent['outcome'],
    correlationId: string,
  ) {
    const who = getActor() ?? { role: 'system' as const, ref: 'SYSTEM' };
    try {
      await audit.record({
        actor: who,
        action: `${service}.${method}`,
        resource: { type: service, ref: findResourceRef(args) },
        purpose: 'service-request',
        outcome,
        channel: CHANNEL_FOR_ROLE[who.role],
        correlationId,
      });
    } catch {
      // Audit must never break the person's journey. A real system would alert here.
    }
  }

  async function invoke<T>(
    service: string,
    method: string,
    args: unknown[],
    run: () => Promise<T>,
  ): Promise<T> {
    const started = platform.clock.now().getTime();
    const correlationId = nextCorrelationId(platform.clock.now());
    const kind: GatewayCallRecord['kind'] = isReadMethod(method) ? 'read' : 'mutation';
    const operation = `${service}.${method}`;
    const actor = getActor();
    let attempts = 0;
    let replayed = false;

    const finish = (outcome: GatewayCallRecord['outcome'], category: ErrorCategory | null) => {
      const record: GatewayCallRecord = {
        correlationId,
        service,
        method,
        kind,
        outcome,
        category,
        attempts,
        durationMs: platform.clock.now().getTime() - started,
        replayed,
      };
      platform.bus.publish(TOPICS.gatewayCall, record);
    };

    // Staff and partner reads are audited too: who looked at what, and when.
    const auditable =
      service !== 'audit' &&
      (kind === 'mutation' || actor?.role === 'staff' || actor?.role === 'partner');

    try {
      const idempotencyKey = kind === 'mutation' ? findIdempotencyKey(args) : null;
      if (kind === 'mutation' && !idempotencyKey && !KEYLESS_MUTATIONS.has(operation)) {
        throw new GatewayError('VALIDATION', {
          safeMessage: 'This request could not be sent safely. Please try again.',
        });
      }
      const storeKey = idempotencyKey ? `${operation}:${idempotencyKey}` : null;
      if (storeKey) {
        const stored = readIdempotent(storeKey);
        if (stored) {
          replayed = true;
          finish('ok', null);
          return stored.result as T;
        }
      }

      let lastError: GatewayError | null = null;
      while (attempts <= maxRetries) {
        attempts += 1;
        try {
          const settings = platform.settings.get();
          if (settings.network === 'offline') throw new GatewayError('OFFLINE');
          const latency = settings.network === 'slow' ? SLOW_LATENCY_MS : settings.latencyMs;
          if (latency > 0) await sleep(latency);
          if (settings.network === 'error') throw new GatewayError('UNAVAILABLE');

          const result = await withTimeout(run(), timeoutMs);
          if (storeKey) writeIdempotent(storeKey, result);
          if (auditable) await recordAudit(service, method, args, 'SUCCESS', correlationId);
          finish('ok', null);
          return result;
        } catch (error) {
          lastError = toGatewayError(error, correlationId);
          // Offline fails fast: retrying only makes the person wait.
          const retry =
            lastError.retryable && lastError.category !== 'OFFLINE' && attempts <= maxRetries;
          if (!retry) break;
          await sleep(200 * 2 ** (attempts - 1));
        }
      }
      throw lastError ?? new GatewayError('UNKNOWN', { traceRef: correlationId });
    } catch (error) {
      const mapped = toGatewayError(error, correlationId);
      if (auditable) {
        await recordAudit(
          service,
          method,
          args,
          mapped.category === 'FORBIDDEN' ? 'DENIED' : 'FAILED',
          correlationId,
        );
      }
      finish('error', mapped.category);
      throw mapped;
    }
  }

  function wrap<T extends object>(service: string, port: T): T {
    return new Proxy(port, {
      get(target, property, receiver) {
        const value: unknown = Reflect.get(target, property, receiver);
        if (typeof value !== 'function' || typeof property !== 'string') return value;
        return (...args: unknown[]) =>
          invoke(service, property, args, () =>
            (value as (...a: unknown[]) => Promise<unknown>).apply(target, args),
          );
      },
    });
  }

  return { wrap };
}

export function createGateway(platform: Platform, options: GatewayOptions = {}): Gateway {
  let actor: GatewayActor | null = null;

  // Raw services. Only this file ever touches them.
  const audit = createAuditService(platform);
  const catalogue = createCatalogueService();
  const identity = createIdentityService(platform);
  const appointments = createAppointmentsService(platform);
  const payments = createPaymentsService(platform);
  const support = createSupportService(platform);
  const workflow = createWorkflowService(platform, { catalogue });
  const whatsapp = createWhatsAppService(platform);
  const notifications = createNotificationsService(platform, { whatsapp, workflow });

  // Event-driven status: every workflow event fans out to the person's channels.
  const pending = new Set<Promise<void>>();
  platform.bus.subscribe(TOPICS.caseEvent, (event) => {
    const work: Promise<void> = notifications
      .handleCaseEvent(event.payload as CaseEvent)
      .catch(() => undefined)
      .finally(() => pending.delete(work));
    pending.add(work);
  });

  const { wrap } = createCallPolicy({
    platform,
    audit,
    getActor: () => actor,
    timeoutMs: options.timeoutMs ?? 8000,
    maxRetries: options.maxRetries ?? 2,
    sleep: options.sleep ?? defaultSleep,
  });

  return {
    identity: wrap('identity', identity),
    catalogue: wrap('catalogue', catalogue),
    workflow: wrap('workflow', workflow),
    appointments: wrap('appointments', appointments),
    payments: wrap('payments', payments),
    notifications: wrap<NotificationsPort>('notifications', notifications),
    whatsapp: wrap<WhatsAppPort>('whatsapp', whatsapp),
    support: wrap('support', support),
    audit: wrap('audit', audit),
    platform,
    setActor(next) {
      actor = next;
    },
    async whenIdle() {
      while (pending.size > 0) await Promise.all([...pending]);
    },
  };
}

/** Races a call against a timeout, mapping the timeout to a safe `TIMEOUT` error. */
function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new GatewayError('TIMEOUT')), timeoutMs);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('adapter failure'));
      },
    );
  });
}

/**
 * Nothing but a `GatewayError` leaves the gateway. Unknown failures become a
 * generic safe message; internal detail and stack traces are dropped.
 */
export function toGatewayError(error: unknown, traceRef: string): GatewayError {
  if (isGatewayError(error)) {
    return error.traceRef === traceRef
      ? error
      : new GatewayError(error.category, { safeMessage: error.safeMessage, traceRef });
  }
  return new GatewayError('UNKNOWN', { traceRef });
}
