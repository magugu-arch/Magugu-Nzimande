'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/instance';
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session';
import { text } from './shared';

/** Demo sign-in and the role switcher: act as one of the demo staff accounts. */
export async function signInAction(formData: FormData): Promise<void> {
  const result = getStore().startSession(text(formData, 'accountId'));
  if (!result.ok) redirect(`/sign-in?refused=${result.code}`);
  (await cookies()).set(SESSION_COOKIE, result.data.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signOutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  revalidatePath('/', 'layout');
  redirect('/sign-in');
}
