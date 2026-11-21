import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Permission } from '@scarlets/domain';
import { getStore } from './instance';
import { isConsoleRole, mayAct } from './rbac';
import type { Actor } from './types';

/**
 * DEMO sign-in. The cookie holds a demo account id and nothing else. The role
 * is looked up in the store on every request, so it cannot be set from the
 * browser and a role change takes effect on the next click. A real deployment
 * replaces this with the club's identity provider.
 */
export const SESSION_COOKIE = 'so_admin_account';
export const SESSION_MAX_AGE = 60 * 60 * 8;

export const getActor = cache(async (): Promise<Actor | null> => {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const user = getStore().getStaff(id);
  if (!user || user.system || !isConsoleRole(user.role)) return null;
  return { id: user.id, name: user.name, role: user.role };
});

/** For pages: the signed-in actor, or a redirect to the sign-in screen. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect('/sign-in');
  return actor;
}

/** For pages: may this actor see something that needs `permission`? */
export function allowed(actor: Actor, permission: Permission): boolean {
  return mayAct(actor.role, permission);
}
