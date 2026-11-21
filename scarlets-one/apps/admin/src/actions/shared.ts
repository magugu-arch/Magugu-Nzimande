import 'server-only';
import { revalidatePath } from 'next/cache';
import { getActor } from '@/lib/session';
import type { Actor, Result } from '@/lib/types';

/** What a Server Action sends back to the form that called it. */
export interface ActionResult {
  ok: boolean;
  message: string;
  /** Where to go next, for actions that create something. */
  redirectTo?: string;
}

/**
 * Every Server Action runs through here.
 *
 * The actor comes from the session cookie and the store, on the server; the
 * browser never says who it is or what role it has. The store then checks
 * that role against the permission the mutation needs and writes the audit
 * record, so hiding a button is never what keeps someone out.
 */
export async function act<T>(
  run: (actor: Actor) => Result<T>,
  next?: (data: T) => string,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) {
    return { ok: false, message: 'Refused. Your demo session has ended: sign in again.' };
  }
  const result = run(actor);
  // Every mutation, and every refusal, also changes the overview and the audit log.
  revalidatePath('/', 'layout');
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: result.message, redirectTo: next?.(result.data) };
}

export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/**
 * Every field the browser sent, apart from the entity id and the framework's
 * own. Passing all of them on (rather than picking the ones a form is meant
 * to have) lets the store's strict schemas refuse a field that should not be
 * there, such as a score on a fixture.
 */
export function fields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key === 'id' || key.startsWith('$ACTION')) continue;
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}
