import { beforeEach, describe, expect, it } from 'vitest';
import { PermissionError, type Role } from '@kc-one/contracts';
import { readAdminConfig } from '@/lib/env';
import { decodeSession, encodeSession, type StaffSession } from '@/lib/session';
import {
  createCampaign,
  createContent,
  currentRole,
  dashboard,
  listAudit,
  listQueue,
  moderate,
  parseSast,
  resetStore,
  scheduleCampaign,
  setContentStatus,
  setStaffRole,
  ValidationError,
} from '@/lib/store';

const as = (role: Role, sub = `demo-${role}`): StaffSession => ({
  sub,
  name: `Test ${role}`,
  role,
  exp: Math.floor(Date.now() / 1000) + 3600,
  demo: true,
});
const root = as('super_admin', 'demo-staff-root');
const content = as('content_admin', 'demo-staff-content');
const mod = as('moderator', 'demo-staff-mod');
const support = as('support_agent', 'demo-staff-support');
const analyst = as('analyst', 'demo-staff-analyst');

beforeEach(() => resetStore());

describe('admin configuration', () => {
  it('runs locally with a development secret and demo sign-in', () => {
    const c = readAdminConfig({});
    expect(c.appEnv).toBe('local');
    expect(c.demoSignIn).toBe(true);
  });

  it('fails clearly outside local development without a real secret', () => {
    expect(() => readAdminConfig({ ADMIN_APP_ENV: 'staging' })).toThrow(/ADMIN_SESSION_SECRET/);
  });

  it('refuses demo sign-in and demo adapters in production, and names missing variables', () => {
    const secret = 'x'.repeat(40);
    expect(() =>
      readAdminConfig({ ADMIN_APP_ENV: 'production', ADMIN_SESSION_SECRET: secret }),
    ).toThrow(/SUPABASE_URL is required/);
    const ok = readAdminConfig({
      ADMIN_APP_ENV: 'production',
      ADMIN_SESSION_SECRET: secret,
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'k',
    });
    expect(ok.demoSignIn).toBe(false);
    expect(() =>
      readAdminConfig({
        ADMIN_APP_ENV: 'production',
        ADMIN_SESSION_SECRET: secret,
        SUPABASE_URL: 'https://x.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'k',
        ADMIN_FEATURE_CONTENT: 'demo',
      }),
    ).toThrow(/blocked in production/);
  });
});

describe('session cookie', () => {
  const secret = 's'.repeat(40);
  it('round-trips a signed session', () => {
    expect(decodeSession(encodeSession(root, secret), secret)).toMatchObject({
      sub: root.sub,
      role: 'super_admin',
    });
  });

  it('rejects tampering, a wrong secret and expiry', () => {
    const token = encodeSession(analyst, secret);
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...analyst, role: 'super_admin' })).toString(
      'base64url',
    );
    expect(decodeSession(`${forged}.${sig}`, secret)).toBeNull();
    expect(decodeSession(`${payload}.${sig}x`, secret)).toBeNull();
    expect(decodeSession(token, 'other'.repeat(10))).toBeNull();
    expect(decodeSession(encodeSession({ ...analyst, exp: 1 }, secret), secret)).toBeNull();
    expect(decodeSession(undefined, secret)).toBeNull();
  });
});

describe('permissions are enforced in the data layer', () => {
  it('lets content admins draft and publish, and nobody else write content', () => {
    const row = createContent(content, { title: 'New story', summary: '', kind: 'article' });
    setContentStatus(content, row.id, 'published');
    expect(() => createContent(mod, { title: 'x', summary: '', kind: 'article' })).toThrow(
      PermissionError,
    );
    expect(() => createContent(analyst, { title: 'x', summary: '', kind: 'article' })).toThrow(
      PermissionError,
    );
    expect(() => setContentStatus(support, row.id, 'archived')).toThrow(PermissionError);
  });

  it('refuses scheduling content in the past', () => {
    const row = createContent(content, { title: 'Later', summary: '', kind: 'article' });
    expect(() => setContentStatus(content, row.id, 'scheduled', '2020-01-01T10:00')).toThrow(
      ValidationError,
    );
    setContentStatus(content, row.id, 'scheduled', new Date(Date.now() + 86_400_000).toISOString());
  });

  it('requires a reason and an allowed transition for moderation', () => {
    expect(() => moderate(mod, 'demo-q-1', 'approve', '   ')).toThrow(/reason/);
    expect(moderate(mod, 'demo-q-1', 'approve', 'Meets the rules')).toBe('approved');
    expect(() => moderate(mod, 'demo-q-1', 'approve', 'again')).toThrow(/can’t approve/);
  });

  it('lets support agents escalate only, and keeps content admins and analysts out', () => {
    expect(moderate(support, 'demo-q-2', 'escalate', 'Privacy report')).toBe('escalated');
    expect(() => moderate(support, 'demo-q-1', 'approve', 'x')).toThrow(PermissionError);
    expect(() => moderate(content, 'demo-q-1', 'reject', 'x')).toThrow(PermissionError);
    expect(() => moderate(analyst, 'demo-q-1', 'reject', 'x')).toThrow(PermissionError);
    expect(() => listQueue(content)).toThrow(PermissionError);
  });

  it('validates campaigns and separates drafting from scheduling', () => {
    expect(() =>
      createCampaign(content, {
        category: 'matchday',
        title: 'T',
        body: 'B',
        deepLink: 'https://evil.example',
        audience: 'opted_in_all',
        fixtureId: null,
      }),
    ).toThrow(/allow-list/);
    expect(() =>
      createCampaign(content, {
        category: 'account',
        title: 'T',
        body: 'B',
        deepLink: null,
        audience: 'opted_in_all',
        fixtureId: null,
      }),
    ).toThrow(/transactional/);
    const c = createCampaign(content, {
      category: 'matchday',
      title: 'Line-ups',
      body: 'In soon',
      deepLink: '/match',
      audience: 'opted_in_all',
      fixtureId: null,
    });
    const later = new Date(Date.now() + 3_600_000).toISOString();
    expect(() => scheduleCampaign(content, c.id, later, false)).toThrow(/Confirm/);
    expect(() => scheduleCampaign(content, c.id, new Date().toISOString(), true)).toThrow(
      /five minutes/,
    );
    expect(() => scheduleCampaign(mod, c.id, later, true)).toThrow(PermissionError);
    scheduleCampaign(content, c.id, later, true);
  });

  it('lets only super admins change roles, never their own, and applies changes at once', () => {
    expect(() => setStaffRole(mod, 'demo-staff-analyst', 'super_admin')).toThrow(PermissionError);
    expect(() => setStaffRole(root, root.sub, 'analyst')).toThrow(/own role/);
    setStaffRole(root, 'demo-staff-mod', 'analyst');
    expect(currentRole('demo-staff-mod')).toBe('analyst');
  });

  it('audits every change, readable only with audit.read', () => {
    moderate(mod, 'demo-q-1', 'approve', 'Meets the rules');
    const c = createContent(content, { title: 'Audited', summary: '', kind: 'article' });
    setContentStatus(content, c.id, 'published');
    const actions = listAudit(analyst).map((a) => a.action);
    expect(actions).toEqual(['content.published', 'content.create', 'fan_post.approve']);
    expect(() => listAudit(mod)).toThrow(PermissionError);
  });

  it('counts work waiting for staff', () => {
    expect(dashboard(analyst)).toMatchObject({ awaitingReview: 2, escalated: 1, openReports: 1 });
  });
});

describe('SAST date inputs', () => {
  it('reads a bare datetime-local value as UTC+2', () => {
    expect(parseSast('2026-11-10T15:30')?.toISOString()).toBe('2026-11-10T13:30:00.000Z');
    expect(parseSast('2026-11-10T13:30:00Z')?.toISOString()).toBe('2026-11-10T13:30:00.000Z');
    expect(parseSast('nonsense')).toBeNull();
  });
});
