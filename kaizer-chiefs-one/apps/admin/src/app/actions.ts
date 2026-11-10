'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import {
  AUDIENCES,
  CONTENT_STATUSES,
  MODERATION_ACTIONS,
  NOTIFICATION_CATEGORIES,
  PermissionError,
  ROLES,
  type ContentStatus,
  type ModerationAction,
  type Role,
} from '@kc-one/contracts';
import { requireSession } from '@/lib/dal';
import { readAdminConfig } from '@/lib/env';
import { encodeSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/session';
import {
  cancelCampaign,
  createCampaign,
  createContent,
  DEMO_STAFF,
  moderate,
  scheduleCampaign,
  setContentStatus,
  setStaffRole,
  ValidationError,
} from '@/lib/store';

/**
 * Server actions are public HTTP endpoints, so each one re-checks the
 * session and the store re-checks the permission. Expected failures come
 * back to the page as a notice; anything else surfaces as an error.
 */
async function run(path: string, fn: () => void, done: string) {
  let notice = done;
  let tone: 'ok' | 'error' = 'ok';
  try {
    fn();
  } catch (e) {
    if (e instanceof ValidationError || e instanceof PermissionError) {
      notice = e instanceof PermissionError ? 'Your role does not allow that.' : e.message;
      tone = 'error';
    } else {
      throw e;
    }
  }
  refresh();
  redirect(`${path}?notice=${encodeURIComponent(notice)}&tone=${tone}`);
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '');
function oneOf<T extends string>(value: string, options: readonly T[], label: string): T {
  if (!(options as readonly string[]).includes(value))
    throw new ValidationError(`Unknown ${label}.`);
  return value as T;
}

export async function signInDemo(form: FormData) {
  const config = readAdminConfig();
  if (!config.demoSignIn) redirect('/sign-in?notice=Demo%20sign-in%20is%20disabled&tone=error');
  const staff = DEMO_STAFF.find((s) => s.id === str(form, 'staff'));
  if (!staff) redirect('/sign-in?notice=Choose%20a%20demo%20role&tone=error');
  const token = encodeSession(
    {
      sub: staff.id,
      name: staff.name,
      role: staff.role,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      demo: true,
    },
    config.sessionSecret,
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect('/');
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/sign-in');
}

export async function createContentAction(form: FormData) {
  const actor = await requireSession();
  await run(
    '/content',
    () =>
      createContent(actor, {
        title: str(form, 'title'),
        summary: str(form, 'summary'),
        kind: oneOf(str(form, 'kind'), ['article', 'campaign'] as const, 'kind'),
      }),
    'Draft saved.',
  );
}

export async function setContentStatusAction(form: FormData) {
  const actor = await requireSession();
  await run(
    '/content',
    () => {
      const status = oneOf<ContentStatus>(str(form, 'status'), CONTENT_STATUSES, 'status');
      setContentStatus(actor, str(form, 'id'), status, str(form, 'publishAt') || null);
    },
    'Status updated.',
  );
}

export async function moderateAction(form: FormData) {
  const actor = await requireSession();
  await run(
    '/moderation',
    () => {
      const action = oneOf<ModerationAction>(str(form, 'action'), MODERATION_ACTIONS, 'action');
      moderate(actor, str(form, 'id'), action, str(form, 'reason'));
    },
    'Decision recorded.',
  );
}

export async function createCampaignAction(form: FormData) {
  const actor = await requireSession();
  await run(
    '/notifications',
    () =>
      createCampaign(actor, {
        category: oneOf(str(form, 'category'), NOTIFICATION_CATEGORIES, 'category'),
        title: str(form, 'title'),
        body: str(form, 'body'),
        deepLink: str(form, 'deepLink') || null,
        audience: oneOf(str(form, 'audience'), AUDIENCES, 'audience'),
        fixtureId: str(form, 'fixtureId') || null,
      }),
    'Draft saved.',
  );
}

export async function scheduleCampaignAction(form: FormData) {
  const actor = await requireSession();
  await run(
    '/notifications',
    () => scheduleCampaign(actor, str(form, 'id'), str(form, 'when'), form.get('confirm') === 'on'),
    'Scheduled. Delivery stays off until the push provider is connected.',
  );
}

export async function cancelCampaignAction(form: FormData) {
  const actor = await requireSession();
  await run('/notifications', () => cancelCampaign(actor, str(form, 'id')), 'Campaign cancelled.');
}

export async function setRoleAction(form: FormData) {
  const actor = await requireSession();
  await run(
    '/roles',
    () => setStaffRole(actor, str(form, 'id'), oneOf<Role>(str(form, 'role'), ROLES, 'role')),
    'Role updated.',
  );
}
