import './env';
import { createServer, type Server } from 'node:http';
import type { PersonaId } from '../../src/core/adapters/contracts';
import { state } from '../../src/core/adapters/mock/state';
import { providerContext, setMockLatencyForTesting } from '../../src/core/adapters/runtime';
import { personas } from '../../src/core/fixtures/people';
import type { Role, SharingScope } from '../../src/core/domain/models';
import { decide } from '../../src/core/permissions/policy';
import {
  approve,
  authorizePage,
  decidePayment,
  discovery,
  exchange,
  issueSession,
  paymentPage,
  PERSONAS,
  refresh,
  revoke,
  sessionFor,
} from './auth';
import { consoleAction, consoleView, operatorById } from './console';
import { cors, fail, html, HttpError, readJson, redirect, send } from './http';
import { describeAmount, providers, ROUTES, userById, type Ctx } from './routes';

/**
 * NMU ONE reference BFF.
 *
 *   npm run bff                 # http://localhost:8787
 *
 * Implements the whole contract in docs/INTEGRATIONS.md over the mock
 * connectors, with real sessions, the shared permission policy on every
 * route, consent for parents, an audit log, and development stand-ins for
 * NMU SSO and the payment provider. Point the app at it with
 * EXPO_PUBLIC_DATA_MODE=live and EXPO_PUBLIC_BFF_BASE_URL.
 *
 * It is also the operator console's backend (/v1/console/*): staff sign in
 * with the same SSO and every console action runs here, as them.
 */

// The mock connectors' simulated latency is for the app's demo mode; the
// network supplies real latency here.
setMockLatencyForTesting(Number(process.env.BFF_LATENCY_MS ?? 0));

/** Development stand-ins (sign-in page, payment page) are on unless BFF_DEV=0. */
const DEV = process.env.BFF_DEV !== '0';

const compiled = ROUTES.map((r) => ({
  ...r,
  re: new RegExp(`^${r.path.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`),
}));

// The mock connectors act for one person at a time (a shared context), so
// requests take turns. A production BFF passes identity per call instead.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export interface AuditEntry {
  at: string;
  userId: string;
  role: string;
  action: string;
  route: string;
  status: number;
}
export const auditLog: AuditEntry[] = [];
function audit(entry: AuditEntry) {
  auditLog.unshift(entry);
  if (auditLog.length > 1000) auditLog.length = 1000;
  if (process.env.BFF_LOG === '1') console.log(JSON.stringify(entry));
}

export function createBff(): Server {
  return createServer(async (req, res) => {
    cors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const base = process.env.BFF_PUBLIC_URL ?? `http://${req.headers.host ?? 'localhost'}`;
    try {
      if (url.pathname === '/healthz') return send(res, 200, { ok: true });

      // ── Development identity provider and payment page ──────────────────
      if (DEV && url.pathname === '/.well-known/openid-configuration')
        return send(res, 200, discovery(base));
      if (DEV && url.pathname === '/dev-sso/authorize')
        return html(res, 200, authorizePage(url.searchParams));
      if (DEV && url.pathname === '/dev-sso/approve')
        return redirect(res, approve(url.searchParams));
      const pay = url.pathname.match(/^\/dev-pay\/([^/]+)(?:\/(approve|cancel))?$/);
      if (DEV && pay) {
        const id = pay[1]!;
        if (pay[2]) return redirect(res, decidePayment(id, pay[2] === 'approve'));
        const intent = state.payments[id];
        if (!intent) throw new HttpError(404, 'not-found', 'Unknown payment');
        return html(res, 200, paymentPage(id, describeAmount(intent.amount.cents), intent.purpose));
      }

      // ── Sessions ────────────────────────────────────────────────────────
      if (req.method === 'POST' && url.pathname === '/v1/auth/session') {
        const body = (await readJson(req)) as Record<string, unknown>;
        let persona: PersonaId;
        if (typeof body.code === 'string') persona = exchange(body, 'app') as PersonaId;
        else if (DEV)
          persona =
            (body.persona as PersonaId) ?? (process.env.BFF_DEV_PERSONA as PersonaId) ?? 'student';
        else throw new HttpError(401, 'unauthorised', 'Sign in with NMU SSO');
        if (!PERSONAS.includes(persona)) throw new HttpError(422, 'invalid', 'Unknown persona');
        const user = userById(personas[persona].id);
        const session = issueSession(user.id);
        audit({
          at: new Date().toISOString(),
          userId: user.id,
          role: user.roles[0] ?? '',
          action: 'signed in',
          route: url.pathname,
          status: 200,
        });
        return send(res, 200, { session, user });
      }
      if (req.method === 'POST' && url.pathname === '/v1/auth/refresh') {
        const body = (await readJson(req)) as Record<string, unknown>;
        return send(res, 200, refresh(body.refreshToken));
      }
      if (req.method === 'POST' && url.pathname === '/v1/auth/sign-out') {
        revoke(req.headers.authorization);
        return send(res, 204);
      }

      // ── The operator console ────────────────────────────────────────────
      if (req.method === 'POST' && url.pathname === '/v1/console/session') {
        const body = (await readJson(req)) as Record<string, unknown>;
        let operatorId: string;
        if (typeof body.code === 'string') operatorId = exchange(body, 'console');
        else if (DEV && typeof body.operator === 'string') operatorId = body.operator;
        else throw new HttpError(401, 'unauthorised', 'Sign in with NMU SSO');
        const operator = operatorById(operatorId);
        if (!operator) throw new HttpError(403, 'forbidden', 'That account can’t use the console');
        const session = issueSession(operator.id, 'operator');
        audit({
          at: new Date().toISOString(),
          userId: operator.id,
          role: operator.role,
          action: 'console: signed in',
          route: url.pathname,
          status: 200,
        });
        return send(res, 200, { session, operator });
      }
      if (req.method === 'GET' && url.pathname === '/v1/console/state') {
        const session = sessionFor(req.headers.authorization, 'operator');
        if (!operatorById(session.userId))
          throw new HttpError(403, 'forbidden', 'No longer an operator');
        return send(res, 200, consoleView(session.userId));
      }
      const consoleRoute = url.pathname.match(/^\/v1\/console\/actions\/([\w-]+)$/);
      if (req.method === 'POST' && consoleRoute) {
        const session = sessionFor(req.headers.authorization, 'operator');
        const operator = operatorById(session.userId);
        if (!operator) throw new HttpError(403, 'forbidden', 'No longer an operator');
        const body = await readJson(req);
        const entry = { userId: operator.id, role: operator.role, route: url.pathname };
        try {
          const r = consoleAction(operator.id, consoleRoute[1]!, body);
          audit({
            at: new Date().toISOString(),
            ...entry,
            action: `console: ${r.action}`,
            status: 200,
          });
          return send(res, 200, {
            message: r.message,
            ...(r.id ? { id: r.id } : {}),
            data: r.data,
          });
        } catch (e) {
          // A refusal is recorded against the operator who tried.
          const status = fail(res, e);
          if (status === 403)
            audit({ at: new Date().toISOString(), ...entry, action: 'console: refused', status });
          return;
        }
      }

      // ── The contract ────────────────────────────────────────────────────
      const route = compiled.find((r) => r.method === req.method && r.re.test(url.pathname));
      if (!route) throw new HttpError(404, 'not-found', 'No such route');
      const session = sessionFor(req.headers.authorization);
      const body = (req.method === 'POST' ? await readJson(req) : {}) as Record<string, unknown>;
      const params = (url.pathname.match(route.re)?.groups ?? {}) as Record<string, string>;
      let who = { userId: session.userId, role: '' };

      const result = await exclusive(async () => {
        const user = userById(session.userId);
        const asked = req.headers['x-nmu-role'];
        const role = (typeof asked === 'string' && asked ? asked : user.roles[0]) as Role;
        // A person may act only in a role NMU SSO asserted for them.
        if (!user.roles.includes(role)) throw new HttpError(403, 'forbidden', 'Role not held');
        who = { userId: user.id, role };
        providerContext.set({ userId: user.id, role });
        try {
          let consents: SharingScope[] = [];
          if (role === 'parent') {
            const profile = await providers.guardian.getProfile();
            consents = [...new Set(profile.linkedStudents.flatMap((s) => s.sharing))];
          }
          const ctx: Ctx = {
            userId: user.id,
            user,
            role,
            consents,
            body,
            query: url.searchParams,
            params,
            base,
          };
          const need = typeof route.need === 'function' ? route.need(ctx) : route.need;
          if (need === 'student-only') {
            if (role !== 'student')
              throw new HttpError(403, 'forbidden', 'Only the student can do this');
          } else if (need !== 'signed-in') {
            const decision = decide({ role, lifecycle: user.lifecycle, consents }, need);
            if (!decision.allowed)
              throw new HttpError(403, 'forbidden', `Needs ${need} (${decision.reason})`);
          }
          return await route.handle(ctx);
        } finally {
          providerContext.set({ userId: null, role: null });
        }
      });
      if (route.audit) {
        audit({
          at: new Date().toISOString(),
          ...who,
          action: route.audit,
          route: url.pathname,
          status: 200,
        });
      }
      return send(res, 200, result);
    } catch (e) {
      const status = fail(res, e);
      if (status === 403) {
        audit({
          at: new Date().toISOString(),
          userId: '',
          role: '',
          action: 'access denied',
          route: url.pathname,
          status,
        });
      }
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 8787);
  createBff().listen(port, () => {
    console.log(
      `NMU ONE reference BFF on http://localhost:${port}${DEV ? ' (development sign-in and payment pages on)' : ''}`,
    );
  });
}
