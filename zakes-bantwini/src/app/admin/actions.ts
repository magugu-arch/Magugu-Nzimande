'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { login, logout, requireAdmin, type AdminSession } from '@/lib/auth/admin';
import { isIsoDate } from '@/lib/booking/dates';
import { fieldErrors, PublicEventInput, QuoteInput } from '@/lib/booking/schemas';
import {
  adminAddNote,
  adminChangeStatus,
  adminConfirmBooking,
  adminHoldDate,
  adminRecordManualPayment,
  adminReissueContract,
  adminSaveQuote,
  adminSendQuote,
  adminSetAvailability,
  adminUploadDocument,
  BookingError,
  type Actor,
} from '@/lib/booking/service';
import { parseRandToCents } from '@/lib/booking/quote';
import { AVAILABILITY_STATES, BOOKING_STATUSES, type AvailabilityState, type BookingStatus, type CollaborationRequest, type DocumentRecord } from '@/lib/booking/types';
import { newId } from '@/lib/security/crypto';
import { getStore } from '@/lib/store';

export type AdminState = { ok: boolean; message: string | null; fields?: Record<string, string> };

const actor = (a: AdminSession): Actor => ({ id: a.id, name: a.name, role: a.role });

function fail(error: unknown): AdminState {
  if (error instanceof BookingError) return { ok: false, message: error.message };
  console.error('[admin] action failed', error);
  return { ok: false, message: 'Something went wrong. Nothing was changed.' };
}

function canWrite(a: AdminSession) {
  if (a.role === 'viewer') throw new BookingError('Your role is read-only', 'forbidden');
}

async function audit(a: AdminSession, action: string, detail: Record<string, unknown>) {
  await getStore().insert('audit_log', { id: newId(), bookingId: null, actor: a.name, action, detail, createdAt: new Date().toISOString() });
}

// ── Session ──

export async function loginAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  const result = await login(String(form.get('email') ?? ''), String(form.get('password') ?? ''));
  if (!result.ok) return { ok: false, message: result.error };
  const next = String(form.get('next') ?? '');
  redirect(next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin');
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect('/admin/login');
}

// ── Bookings ──

function booking(id: string) {
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath('/admin');
  revalidatePath('/admin/bookings');
}

export async function changeStatusAction(bookingId: string, _prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const to = String(form.get('status')) as BookingStatus;
  if (!BOOKING_STATUSES.includes(to)) return { ok: false, message: 'Choose a status' };
  try {
    await adminChangeStatus(bookingId, to, actor(admin), String(form.get('note') ?? '') || undefined);
    booking(bookingId);
    return { ok: true, message: 'Status updated.' };
  } catch (e) {
    return fail(e);
  }
}

export async function holdDateAction(bookingId: string, _prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const days = Math.min(Math.max(Number(form.get('days') ?? 7), 1), 60);
  try {
    await adminHoldDate(bookingId, actor(admin), days);
    booking(bookingId);
    return { ok: true, message: `Date held for ${days} days.` };
  } catch (e) {
    return fail(e);
  }
}

export async function saveQuoteAction(bookingId: string, _prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get('payload') ?? '{}'));
  } catch {
    return { ok: false, message: 'The quote could not be read.' };
  }
  const parsed = QuoteInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Check the highlighted quote fields.', fields: fieldErrors(parsed.error) };
  try {
    const quote = await adminSaveQuote(bookingId, parsed.data, actor(admin));
    if (form.get('intent') === 'send') {
      await adminSendQuote(quote.id, actor(admin));
      booking(bookingId);
      return { ok: true, message: `Quote v${quote.version} sent to the client.` };
    }
    booking(bookingId);
    return { ok: true, message: `Draft v${quote.version} saved.` };
  } catch (e) {
    return fail(e);
  }
}

export async function reissueContractAction(bookingId: string): Promise<AdminState> {
  const admin = await requireAdmin();
  try {
    await adminReissueContract(bookingId, actor(admin));
    booking(bookingId);
    return { ok: true, message: 'Agreement reissued to the client.' };
  } catch (e) {
    return fail(e);
  }
}

export async function recordPaymentAction(bookingId: string, _prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const cents = parseRandToCents(String(form.get('amount') ?? ''));
  if (cents === null) return { ok: false, message: 'Enter the amount in rand, e.g. 125000 or 125 000,00' };
  const kind = form.get('kind') === 'balance' ? 'balance' : 'deposit';
  try {
    await adminRecordManualPayment(bookingId, kind, cents, String(form.get('reference') ?? ''), actor(admin));
    booking(bookingId);
    return { ok: true, message: 'Payment recorded.' };
  } catch (e) {
    return fail(e);
  }
}

export async function confirmBookingAction(bookingId: string, _prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  try {
    await adminConfirmBooking(bookingId, actor(admin), form.get('override') === 'on', String(form.get('reason') ?? ''));
    booking(bookingId);
    return { ok: true, message: 'Booking confirmed. The client has been notified.' };
  } catch (e) {
    return fail(e);
  }
}

export async function addNoteAction(bookingId: string, _prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  try {
    await adminAddNote(bookingId, actor(admin), String(form.get('body') ?? ''));
    booking(bookingId);
    return { ok: true, message: null };
  } catch (e) {
    return fail(e);
  }
}

export async function uploadDocumentAction(bookingId: string, _prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Choose a file to upload.' };
  const kinds: DocumentRecord['kind'][] = ['agreement', 'rider', 'receipt', 'other', 'brief'];
  const kind = kinds.find((k) => k === form.get('kind')) ?? 'other';
  try {
    await adminUploadDocument(bookingId, { name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) }, kind, form.get('clientVisible') === 'on', actor(admin));
    booking(bookingId);
    return { ok: true, message: 'Document uploaded.' };
  } catch (e) {
    return fail(e);
  }
}

// ── Calendar ──

export async function setAvailabilityAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const date = String(form.get('date') ?? '');
  const state = String(form.get('state')) as AvailabilityState;
  if (!isIsoDate(date) || !AVAILABILITY_STATES.includes(state)) return { ok: false, message: 'Choose a date and a state.' };
  try {
    await adminSetAvailability(date, state, String(form.get('note') ?? '').trim() || null, actor(admin));
    revalidatePath('/admin/calendar');
    return { ok: true, message: `${date} set to ${state.toLowerCase().replace('_', ' ')}.` };
  } catch (e) {
    return fail(e);
  }
}

// ── Public events ──

export async function saveEventAction(eventId: string | null, _prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  try {
    canWrite(admin);
  } catch (e) {
    return fail(e);
  }
  const parsed = PublicEventInput.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string')));
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields.', fields: fieldErrors(parsed.error) };
  const d = parsed.data;
  const now = new Date().toISOString();
  const store = getStore();
  const fields = {
    title: d.title,
    date: d.date,
    startTime: d.startTime ?? null,
    venue: d.venue,
    city: d.city,
    country: d.country,
    ticketUrl: d.ticketUrl ?? null,
    description: d.description,
    published: d.published,
    updatedAt: now,
  };
  if (eventId) {
    const existing = await store.get('events', eventId);
    if (!existing || existing.kind !== 'public') return { ok: false, message: 'Event not found.' };
    await store.update('events', eventId, fields);
    await audit(admin, 'public_event_updated', { id: eventId, title: d.title, published: d.published });
  } else {
    const id = newId();
    await store.insert('events', { id, bookingId: null, kind: 'public', endTime: null, createdAt: now, ...fields });
    await audit(admin, 'public_event_created', { id, title: d.title, published: d.published });
  }
  revalidatePath('/admin/events');
  revalidatePath('/live');
  revalidatePath('/');
  return { ok: true, message: d.published ? 'Saved and published on /live.' : 'Saved as a draft (not public).' };
}

export async function deleteEventAction(eventId: string): Promise<void> {
  const admin = await requireAdmin();
  canWrite(admin);
  const store = getStore();
  const existing = await store.get('events', eventId);
  if (existing?.kind === 'public') {
    await store.remove('events', eventId);
    await audit(admin, 'public_event_deleted', { id: eventId, title: existing.title });
  }
  revalidatePath('/admin/events');
  revalidatePath('/live');
}

// ── Inbox ──

const PROPOSAL_STATUSES: CollaborationRequest['status'][] = ['new', 'reviewed', 'archived'];

export async function setProposalStatusAction(id: string, status: CollaborationRequest['status']): Promise<void> {
  const admin = await requireAdmin();
  if (admin.role === 'viewer' || !PROPOSAL_STATUSES.includes(status)) return;
  const updated = await getStore().update('collaboration_requests', id, { status });
  if (updated) await audit(admin, 'proposal_status_changed', { id, status, from: updated.name });
  revalidatePath('/admin', 'layout');
}
