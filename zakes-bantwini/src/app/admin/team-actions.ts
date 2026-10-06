'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, startSession, type AdminSession } from '@/lib/auth/admin';
import { addMember, changeOwnPassword, changeRole, removeMember, resetPassword, TeamError } from '@/lib/auth/team';
import { newId } from '@/lib/security/crypto';
import { getStore } from '@/lib/store';
import type { AdminState } from './actions';

async function audit(a: AdminSession, action: string, detail: Record<string, unknown>) {
  await getStore().insert('audit_log', { id: newId(), bookingId: null, actor: a.name, action, detail, createdAt: new Date().toISOString() });
}

function fail(error: unknown): AdminState {
  if (error instanceof TeamError) return { ok: false, message: error.message };
  console.error('[admin] team action failed', error);
  return { ok: false, message: 'Something went wrong. Nothing was changed.' };
}

export async function addMemberAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  try {
    const { user, password } = await addMember(admin, { email: String(form.get('email') ?? ''), name: String(form.get('name') ?? ''), role: String(form.get('role') ?? '') });
    await audit(admin, 'admin_added', { email: user.email, role: user.role });
    revalidatePath('/admin/team');
    return { ok: true, message: `Account created for ${user.email}. Temporary password: ${password} — give it to them in person or by phone; it is not shown again.` };
  } catch (e) {
    return fail(e);
  }
}

export async function changeRoleAction(id: string, _prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  try {
    const user = await changeRole(admin, id, String(form.get('role') ?? ''));
    await audit(admin, 'admin_role_changed', { email: user.email, role: user.role });
    revalidatePath('/admin/team');
    return { ok: true, message: `${user.name} is now ${user.role === 'owner' ? 'an' : 'a'} ${user.role}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function resetPasswordAction(id: string): Promise<AdminState> {
  const admin = await requireAdmin();
  try {
    const { user, password } = await resetPassword(admin, id);
    await audit(admin, 'admin_password_reset', { email: user.email });
    if (user.id === admin.id) await startSession(user);
    return { ok: true, message: `New temporary password for ${user.email}: ${password} — they are signed out everywhere until they use it.` };
  } catch (e) {
    return fail(e);
  }
}

export async function removeMemberAction(id: string): Promise<AdminState> {
  const admin = await requireAdmin();
  try {
    const user = await removeMember(admin, id);
    await audit(admin, 'admin_removed', { email: user.email });
    revalidatePath('/admin/team');
    return { ok: true, message: `Removed ${user.email}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function changeOwnPasswordAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  try {
    const user = await changeOwnPassword(admin, String(form.get('current') ?? ''), String(form.get('next') ?? ''), String(form.get('confirm') ?? ''));
    // The new hash voids every session, this one included; keep this one going.
    await startSession(user);
    await audit(admin, 'admin_password_changed', { email: user.email });
    return { ok: true, message: 'Password changed. Other devices have been signed out.' };
  } catch (e) {
    return fail(e);
  }
}
