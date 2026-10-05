/**
 * @jest-environment node
 */
import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { request, type IncomingHttpHeaders, type Server } from 'node:http';
import { createBff } from '../bff/src/server';

/**
 * The reference BFF's security boundary: sessions, the permission policy on
 * every route, parent consent, PKCE sign-in and payment ownership.
 */

let server: Server;
let base = '';

beforeAll(async () => {
  server = createBff();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
);

/** Node's own HTTP client: Jest's React Native preset replaces `fetch`. */
function call(
  path: string,
  opts: { token?: string; role?: string; body?: unknown } = {},
): Promise<{ status: number; json: any; headers: IncomingHttpHeaders }> {
  const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  return new Promise((resolve, reject) => {
    const req = request(
      base + path,
      {
        method: payload === undefined ? 'GET' : 'POST',
        headers: {
          ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
          ...(opts.role ? { 'X-NMU-Role': opts.role } : {}),
          ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (d: string) => (text += d));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            json: text ? JSON.parse(text) : undefined,
            headers: res.headers,
          }),
        );
      },
    );
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

const signIn = async (persona: string) =>
  (await call('/v1/auth/session', { body: { persona } })).json.session.accessToken as string;

describe('sessions', () => {
  it('refuses the contract without a session, and serves it with one', async () => {
    expect((await call('/v1/finance/account')).status).toBe(401);
    const token = await signIn('student');
    const account = await call('/v1/finance/account', { token });
    expect(account.status).toBe(200);
    expect(account.json.balance).toEqual({ cents: 425000, currency: 'ZAR' });
  });

  it('rotates on refresh and ends on sign-out', async () => {
    const { json } = await call('/v1/auth/session', { body: { persona: 'student' } });
    const fresh = await call('/v1/auth/refresh', {
      body: { refreshToken: json.session.refreshToken },
    });
    expect(fresh.status).toBe(200);
    expect((await call('/v1/finance/account', { token: json.session.accessToken })).status).toBe(
      401,
    );
    const token = fresh.json.accessToken as string;
    await call('/v1/auth/sign-out', { token, body: {} });
    expect((await call('/v1/finance/account', { token })).status).toBe(401);
  });
});

describe('the permission policy, enforced on the server', () => {
  it('keeps roles to what each person holds', async () => {
    const student = await signIn('student');
    expect((await call('/v1/alumni/jobs', { token: student })).status).toBe(403);
    expect((await call('/v1/alumni/jobs', { token: student, role: 'alumni' })).status).toBe(403);
    const staff = await signIn('staff'); // staff and an alumnus
    expect((await call('/v1/alumni/jobs', { token: staff, role: 'alumni' })).status).toBe(200);
    expect((await call('/v1/finance/account', { token: staff })).status).toBe(403);
  });

  it('shows a parent only what the student shares', async () => {
    const parent = await signIn('parent');
    expect(
      (await call('/v1/guardian/students/u-demo-student/fees', { token: parent })).status,
    ).toBe(200);
    expect((await call('/v1/academic/results', { token: parent })).status).toBe(403);
    expect((await call('/v1/finance/account', { token: parent })).status).toBe(403);
    // Only the student can change what is shared.
    expect((await call('/v1/me/guardians', { token: parent })).status).toBe(403);
  });
});

describe('sign-in with authorization code + PKCE', () => {
  const verifier = 'a'.repeat(64);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const redirectUri = 'http://127.0.0.1:9999/auth/callback';

  async function codeFor(persona: string) {
    const q = new URLSearchParams({
      persona,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'xyz',
    });
    const res = await call(`/dev-sso/approve?${q}`);
    expect(res.status).toBe(302);
    const back = new URL(String(res.headers.location));
    expect(back.searchParams.get('state')).toBe('xyz');
    return back.searchParams.get('code')!;
  }

  it('signs in when the verifier matches, once', async () => {
    const code = await codeFor('parent');
    const res = await call('/v1/auth/session', {
      body: { code, codeVerifier: verifier, redirectUri },
    });
    expect(res.status).toBe(200);
    expect(res.json.user.givenName).toBe('Nomsa');
    const again = await call('/v1/auth/session', {
      body: { code, codeVerifier: verifier, redirectUri },
    });
    expect(again.status).toBe(401);
  });

  it('refuses a code without the right verifier or redirect', async () => {
    const code = await codeFor('student');
    expect(
      (await call('/v1/auth/session', { body: { code, codeVerifier: 'wrong', redirectUri } }))
        .status,
    ).toBe(401);
    const code2 = await codeFor('student');
    expect(
      (
        await call('/v1/auth/session', {
          body: { code: code2, codeVerifier: verifier, redirectUri: 'http://evil.test/cb' },
        })
      ).status,
    ).toBe(401);
  });
});

describe('payments', () => {
  it('lets only the payer confirm a payment', async () => {
    const student = await signIn('student');
    const intent = await call('/v1/payments', {
      token: student,
      body: { amount: { cents: 6200, currency: 'ZAR' }, method: 'card', purpose: 'order' },
    });
    expect(intent.status).toBe(200);
    const staff = await signIn('staff');
    expect(
      (await call(`/v1/payments/${intent.json.id}/confirm`, { token: staff, body: {} })).status,
    ).toBe(404);
    expect(
      (await call(`/v1/payments/${intent.json.id}/confirm`, { token: student, body: {} })).status,
    ).toBe(200);
  });

  it('asks for the capability the purpose needs', async () => {
    const parent = await signIn('parent');
    const res = await call('/v1/payments', {
      token: parent,
      body: { amount: { cents: 10000, currency: 'ZAR' }, method: 'card', purpose: 'fees' },
    });
    expect(res.status).toBe(403);
  });
});

describe('the operator console, on the server', () => {
  const operator = async (id: string) =>
    (await call('/v1/console/session', { body: { operator: id } })).json.session
      .accessToken as string;
  const act = (token: string, name: string, body: unknown) =>
    call(`/v1/console/actions/${name}`, { token, body });
  const draft = {
    title: 'Graduation photos are ready',
    body: 'Your official graduation photos can be viewed from today.',
    category: 'community',
    priority: 'normal',
    segmentId: 'seg-students',
    deepLink: '/events',
    actionLabel: 'See events',
    sendAt: null,
    expiresAt: null,
    respectQuietHours: true,
    channels: { push: true, inApp: true },
  };

  it('keeps console and app sessions apart', async () => {
    const ayanda = await operator('op-ayanda');
    expect((await call('/v1/console/state', { token: ayanda })).status).toBe(200);
    expect((await call('/v1/finance/account', { token: ayanda })).status).toBe(403);
    const student = await signIn('student');
    expect((await call('/v1/console/state', { token: student })).status).toBe(403);
    expect(
      (await call('/v1/console/session', { body: { operator: 'u-demo-student' } })).status,
    ).toBe(403);
  });

  it('checks each operator’s role on the server', async () => {
    const ayanda = await operator('op-ayanda'); // communications officer: writes, can't approve
    const saved = await act(ayanda, 'saveCampaign', { draft, id: null, submit: true });
    expect(saved.status).toBe(200);
    expect(saved.json.data.campaigns[0]).toMatchObject({ authorId: 'op-ayanda' });
    expect((await act(ayanda, 'approveCampaign', { id: saved.json.id, note: '' })).status).toBe(
      403,
    );
    const kagiso = await operator('op-kagiso'); // analyst: read-only
    expect((await act(kagiso, 'saveCampaign', { draft, id: null, submit: false })).status).toBe(
      403,
    );
  });

  it('never lets anyone approve their own notice, even an administrator', async () => {
    const naledi = await operator('op-naledi');
    const saved = await act(naledi, 'saveCampaign', { draft, id: null, submit: true });
    const own = await act(naledi, 'approveCampaign', { id: saved.json.id, note: '' });
    expect(own.status).toBe(422);
    expect(own.json.message).toMatch(/someone else/);
    const lindiwe = await operator('op-lindiwe');
    const approved = await act(lindiwe, 'approveCampaign', { id: saved.json.id, note: 'Fine' });
    expect(approved.status).toBe(200);
    const campaign = approved.json.data.campaigns.find((c: any) => c.id === saved.json.id);
    expect(campaign).toMatchObject({ status: 'sent', approverId: 'op-lindiwe' });
    // The audit trail names the operator the server signed in.
    expect(approved.json.data.audit[0]).toMatchObject({
      operatorId: 'op-lindiwe',
      action: 'Approved and sent notification',
    });
  });

  it('refuses unknown actions and incomplete requests', async () => {
    const naledi = await operator('op-naledi');
    expect((await act(naledi, 'resetDemo', {})).status).toBe(404);
    expect((await act(naledi, 'saveCampaign', {})).status).toBe(422);
  });

  it('signs operators in with PKCE, and only through the console client', async () => {
    const verifier = 'b'.repeat(64);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const redirectUri = 'http://127.0.0.1:9999/auth/callback/';
    const codeFor = async () => {
      const q = new URLSearchParams({
        client_id: 'nmu-one-console',
        persona: 'op-lindiwe',
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: 's',
      });
      const res = await call(`/dev-sso/approve?${q}`);
      return new URL(String(res.headers.location)).searchParams.get('code')!;
    };
    // A console code can't open an app session…
    const first = await codeFor();
    expect(
      (
        await call('/v1/auth/session', {
          body: { code: first, codeVerifier: verifier, redirectUri },
        })
      ).status,
    ).toBe(401);
    // …but signs the operator in to the console.
    const res = await call('/v1/console/session', {
      body: { code: await codeFor(), codeVerifier: verifier, redirectUri },
    });
    expect(res.status).toBe(200);
    expect(res.json.operator).toMatchObject({ id: 'op-lindiwe', role: 'approver' });
  });
});
