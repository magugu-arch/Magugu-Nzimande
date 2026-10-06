import 'server-only';
import { trackServer } from '@/lib/analytics/server';
import { getPaymentProvider, type Checkout, type IncomingNotification } from '@/lib/payments';
import { notify, type NotificationEvent } from '@/lib/notifications';
import { keyedHash, newId, sha256, sign } from '@/lib/security/crypto';
import { siteUrl } from '@/lib/site';
import {
  ALLOWED_DOCUMENT_TYPES,
  getStorage,
  MAX_DOCUMENT_BYTES,
  sniffMatches,
} from '@/lib/storage';
import { getStore, type Store } from '@/lib/store';
import { publicState, toPublicCalendar, type PublicAvailability } from './availability';
import { addDays, daysBetween, formatDayLong, todayIso } from './dates';
import { calculateQuote, formatZar } from './quote';
import type { BookingRequestData, QuoteInputData } from './schemas';
import { availabilityFor, canTransition, STATUS_META } from './status';
import type {
  AdminRole,
  AvailabilityState,
  Booking,
  BookingStatus,
  Contract,
  Customer,
  DocumentRecord,
  EventRecord,
  Payment,
  Quote,
} from './types';
import { EVENT_TYPES, PERFORMANCE_FORMATS } from './types';

export class BookingError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'not_found'
      | 'invalid_state'
      | 'conflict'
      | 'validation'
      | 'forbidden' = 'invalid_state',
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

export type Actor = { id: string; name: string; role: AdminRole } | 'client' | 'system';

const actorName = (a: Actor) => (typeof a === 'string' ? a : a.name);
const now = () => new Date().toISOString();

/** How long an explicit date hold lasts before the reminder job releases it. */
export const HOLD_DAYS = Number(process.env.BOOKING_HOLD_DAYS ?? 7);

// ── References and tokens ──────────────────────────────────────────────────

export function formatReference(year: number, n: number): string {
  return `ZB-${year}-${String(n).padStart(4, '0')}`;
}

/**
 * The client's portal token is derived, not stored: HMAC(APP_SECRET, booking
 * id). Only its SHA-256 sits in the database, for lookup, so a database leak
 * does not leak working links — and any later email can still include one.
 */
export function portalToken(bookingId: string): string {
  return sign(bookingId, 'portal');
}

export function portalUrl(bookingId: string): string {
  return siteUrl(`/book/confirmation/${portalToken(bookingId)}`);
}

// ── Internals ──────────────────────────────────────────────────────────────

async function audit(
  store: Store,
  actor: Actor,
  action: string,
  bookingId: string | null,
  detail: Record<string, unknown> = {},
) {
  await store.insert('audit_log', {
    id: newId(),
    bookingId,
    actor: actorName(actor),
    action,
    detail,
    createdAt: now(),
  });
}

type Loaded = { booking: Booking; customer: Customer; event: EventRecord };

async function load(store: Store, bookingId: string): Promise<Loaded> {
  const booking = await store.get('bookings', bookingId);
  if (!booking) throw new BookingError('Booking not found', 'not_found');
  const [customer, event] = await Promise.all([
    store.get('customers', booking.customerId),
    store.get('events', booking.eventId),
  ]);
  if (!customer || !event) throw new BookingError('Booking record is incomplete', 'not_found');
  return { booking, customer, event };
}

async function announce(
  e: NotificationEvent,
  l: Loaded,
  extra: { quote?: Quote; payment?: Payment } = {},
) {
  await notify(e, { ...l, ...extra, portalUrl: portalUrl(l.booking.id) });
}

/** Follow-ups that must only happen once the writes are committed: messages and analytics. */
type Later = (() => Promise<unknown>)[];

/**
 * One booking step, all-or-nothing: every write in `work` goes through `tx`
 * and commits together, so a failure half-way (a calendar conflict, a lost
 * connection) leaves no half-made booking, quote or payment behind. Messages
 * queued on `later` go out after the commit, never for a rolled-back change.
 */
async function atomic<R>(work: (tx: Store, later: Later) => Promise<R>): Promise<R> {
  const later: Later = [];
  const result = await getStore().transaction((tx) => work(tx, later));
  for (const job of later) {
    try {
      await job();
    } catch (error) {
      console.error('[booking] follow-up after commit failed', error);
    }
  }
  return result;
}

/** Keep the calendar in step with a booking's status. */
async function syncAvailability(store: Store, booking: Booking, event: EventRecord, actor: Actor) {
  const desired = availabilityFor(booking.status);
  const existing = await store.get('availability', event.date);
  if (!desired) {
    if (existing?.bookingId === booking.id) await store.remove('availability', event.date);
    return;
  }
  const ours = existing?.bookingId === booking.id;
  const free = !existing || existing.state === 'AVAILABLE';
  const overridesHold = desired === 'CONFIRMED' && existing?.state === 'ON_HOLD';
  if (ours || free || overridesHold) {
    await store.upsert('availability', {
      date: event.date,
      state: desired,
      bookingId: booking.id,
      note: `${booking.reference} — ${STATUS_META[booking.status].label}`,
      updatedAt: now(),
      updatedBy: actorName(actor),
    });
  } else if (desired === 'CONFIRMED') {
    throw new BookingError(
      `${formatDayLong(event.date)} is already ${existing!.state.toLowerCase().replace('_', ' ')} on the calendar`,
      'conflict',
    );
  }
}

async function setStatus(
  store: Store,
  l: Loaded,
  to: BookingStatus,
  actor: Actor,
  detail: Record<string, unknown> = {},
): Promise<Booking> {
  const from = l.booking.status;
  if (from === to) return l.booking;
  if (!canTransition(from, to)) {
    throw new BookingError(
      `A booking cannot move from ${STATUS_META[from].label} to ${STATUS_META[to].label}`,
    );
  }
  const updated = {
    ...l.booking,
    status: to,
    updatedAt: now(),
    holdExpiresAt: to === 'ON_HOLD' ? l.booking.holdExpiresAt : null,
  };
  await syncAvailability(store, updated, l.event, actor);
  const saved = (await store.update('bookings', l.booking.id, {
    status: to,
    updatedAt: updated.updatedAt,
    holdExpiresAt: updated.holdExpiresAt,
  }))!;
  await audit(store, actor, 'status_changed', l.booking.id, { from, to, ...detail });
  l.booking = saved;
  return saved;
}

function requireRole(actor: Actor, roles: AdminRole[]) {
  if (typeof actor === 'string' || !roles.includes(actor.role))
    throw new BookingError('Your role cannot do this', 'forbidden');
}

const MANAGE: AdminRole[] = ['owner', 'manager'];

// ── Public availability ────────────────────────────────────────────────────

export async function publicAvailability(
  from: string,
  to: string,
): Promise<Record<string, PublicAvailability>> {
  const store = getStore();
  const entries = await store.list('availability', { range: { field: 'date', from, to } });
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return toPublicCalendar(entries, days, todayIso());
}

// ── Public request ─────────────────────────────────────────────────────────

export type UploadedFile = { name: string; type: string; bytes: Buffer };

export async function submitBookingRequest(
  data: BookingRequestData,
  brief: UploadedFile | null,
): Promise<{ reference: string; token: string }> {
  const today = todayIso();
  if (data.eventDate < today)
    throw new BookingError('That date has passed — choose a future date', 'validation');
  if (brief) validateUpload(brief);
  return atomic(async (store, later) => {
    const existing = await store.get('availability', data.eventDate);
    if (publicState(existing?.state) === 'unavailable') {
      throw new BookingError('That date is unavailable — please choose another', 'conflict');
    }

    const createdAt = now();
    const bookingId = newId();
    const year = Number(today.slice(0, 4));
    const reference = formatReference(year, await store.nextReferenceNumber(year));
    const token = portalToken(bookingId);

    const customer: Customer = {
      id: newId(),
      fullName: data.fullName,
      organisation: data.organisation,
      email: data.email.toLowerCase(),
      phone: data.phone,
      whatsappOptIn: data.whatsappOptIn,
      createdAt,
    };
    const eventType = EVENT_TYPES.find((t) => t.key === data.eventType)!.label;
    const event: EventRecord = {
      id: newId(),
      bookingId,
      kind: 'private',
      title: `${eventType}${data.organisation ? ` — ${data.organisation}` : ''}`,
      date: data.eventDate,
      startTime: data.startTime,
      endTime: data.endTime ?? null,
      venue: data.venue,
      city: data.city,
      country: data.country,
      ticketUrl: null,
      description: null,
      published: false,
      createdAt,
      updatedAt: createdAt,
    };
    const booking: Booking = {
      id: bookingId,
      reference,
      customerId: customer.id,
      eventId: event.id,
      status: 'NEW',
      eventType: data.eventType,
      performanceFormat: data.performanceFormat,
      budgetRange: data.budgetRange,
      expectedAttendance: data.expectedAttendance,
      travelRequired: data.travelRequired,
      travelNotes: data.travelNotes,
      accommodationRequired: data.accommodationRequired,
      accommodationNotes: data.accommodationNotes,
      productionNotes: data.productionNotes,
      additionalInfo: data.additionalInfo,
      portalTokenHash: sha256(token),
      holdExpiresAt: null,
      createdAt,
      updatedAt: createdAt,
    };

    await store.insert('customers', customer);
    await store.insert('events', event);
    await store.insert('bookings', booking);
    if (brief) await storeDocument(store, booking.id, brief, 'brief', 'client', true);
    await audit(store, 'client', 'request_submitted', booking.id, {
      reference,
      date: data.eventDate,
      eventType: data.eventType,
    });
    later.push(
      () => announce('enquiry_received', { booking, customer, event }),
      () =>
        trackServer('book_request_submitted', booking.id, {
          eventType: data.eventType,
          format: data.performanceFormat,
        }),
    );
    return { reference, token };
  });
}

function validateUpload(file: UploadedFile) {
  if (!(file.type in ALLOWED_DOCUMENT_TYPES))
    throw new BookingError('Upload a PDF, Word document, JPG or PNG', 'validation');
  if (file.bytes.length > MAX_DOCUMENT_BYTES)
    throw new BookingError('The file is over 10 MB', 'validation');
  if (!sniffMatches(file.type, file.bytes.subarray(0, 8)))
    throw new BookingError('The file does not look like the type it claims to be', 'validation');
}

async function storeDocument(
  store: Store,
  bookingId: string,
  file: UploadedFile,
  kind: DocumentRecord['kind'],
  uploadedBy: DocumentRecord['uploadedBy'],
  clientVisible: boolean,
): Promise<DocumentRecord> {
  validateUpload(file);
  const id = newId();
  const ext = ALLOWED_DOCUMENT_TYPES[file.type]!;
  const key = `${bookingId}/${id}.${ext}`;
  await getStorage().put(key, file.bytes, file.type);
  const safeName = file.name.replace(/[^\w.\- ]+/g, '_').slice(-120) || `document.${ext}`;
  return store.insert('documents', {
    id,
    bookingId,
    kind,
    filename: safeName,
    contentType: file.type,
    size: file.bytes.length,
    storageKey: key,
    uploadedBy,
    clientVisible,
    createdAt: now(),
  });
}

// ── Client portal ──────────────────────────────────────────────────────────

export type Portal = Loaded & {
  quote: Quote | null;
  contract: Contract | null;
  payments: Payment[];
  documents: DocumentRecord[];
  depositPaid: boolean;
  balancePaid: boolean;
};

export async function bookingIdForToken(token: string): Promise<string | null> {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const booking = await getStore().findOne('bookings', { portalTokenHash: sha256(token) });
  return booking?.id ?? null;
}

export async function getPortal(token: string): Promise<Portal | null> {
  const id = await bookingIdForToken(token);
  if (!id) return null;
  const store = getStore();
  const l = await load(store, id);
  const [quotes, contracts, payments, documents] = await Promise.all([
    store.list('quotes', { where: { bookingId: id }, orderBy: { field: 'version', dir: 'desc' } }),
    store.list('contracts', {
      where: { bookingId: id },
      orderBy: { field: 'createdAt', dir: 'desc' },
    }),
    store.list('payments', {
      where: { bookingId: id },
      orderBy: { field: 'createdAt', dir: 'desc' },
    }),
    store.list('documents', {
      where: { bookingId: id, clientVisible: true },
      orderBy: { field: 'createdAt', dir: 'desc' },
    }),
  ]);
  const quote =
    quotes.find((q) => q.status === 'accepted') ??
    quotes.find((q) => q.status === 'sent' || q.status === 'changes_requested') ??
    null;
  const contract = contracts.find((c) => c.status === 'signed' || c.status === 'sent') ?? null;
  return {
    ...l,
    quote,
    contract,
    payments,
    documents,
    depositPaid: payments.some((p) => p.kind === 'deposit' && p.status === 'complete'),
    balancePaid: payments.some((p) => p.kind === 'balance' && p.status === 'complete'),
  };
}

async function requirePortal(token: string): Promise<Portal> {
  const portal = await getPortal(token);
  if (!portal) throw new BookingError('This booking link is not valid', 'not_found');
  return portal;
}

export async function acceptQuote(token: string, quoteId: string): Promise<void> {
  const p = await requirePortal(token);
  return atomic(async (store, later) => {
    const quote = await store.get('quotes', quoteId);
    if (!quote || quote.bookingId !== p.booking.id)
      throw new BookingError('Quote not found', 'not_found');
    if (quote.status !== 'sent')
      throw new BookingError('This quote is no longer open for acceptance');
    if (quote.validUntil < todayIso())
      throw new BookingError('This quote has expired — request an updated quote');
    const respondedAt = now();
    const accepted = (await store.update('quotes', quote.id, { status: 'accepted', respondedAt }))!;
    await setStatus(store, p, 'AWAITING_DEPOSIT', 'client', { quote: quote.version });
    await audit(store, 'client', 'quote_accepted', p.booking.id, {
      version: quote.version,
      total: quote.totalCents,
    });
    later.push(
      () => announce('quote_accepted', p, { quote: accepted }),
      () => trackServer('quote_accepted', p.booking.id, { total: quote.totalCents }),
    );
    await issueContract(store, p, accepted, 'system', later);
  });
}

export async function requestQuoteChanges(
  token: string,
  quoteId: string,
  note: string,
): Promise<void> {
  const p = await requirePortal(token);
  return atomic(async (store) => {
    const quote = await store.get('quotes', quoteId);
    if (!quote || quote.bookingId !== p.booking.id)
      throw new BookingError('Quote not found', 'not_found');
    if (quote.status !== 'sent') throw new BookingError('This quote is no longer open');
    const trimmed = note.trim().slice(0, 2000);
    if (trimmed.length < 5)
      throw new BookingError('Tell us what you would like changed', 'validation');
    await store.update('quotes', quote.id, {
      status: 'changes_requested',
      respondedAt: now(),
      clientResponseNote: trimmed,
    });
    await setStatus(store, p, 'IN_REVIEW', 'client', { reason: 'changes requested' });
    await audit(store, 'client', 'quote_changes_requested', p.booking.id, {
      version: quote.version,
    });
  });
}

function contractTerms(l: Loaded, q: Quote): string {
  const format =
    PERFORMANCE_FORMATS.find((f) => f.key === l.booking.performanceFormat)?.label ??
    l.booking.performanceFormat;
  return [
    `PERFORMANCE AGREEMENT — ${l.booking.reference}`,
    '',
    'Artist: Zakes Bantwini, represented by management',
    `Client: ${l.customer.fullName}${l.customer.organisation ? `, for ${l.customer.organisation}` : ''}`,
    `Event: ${l.event.title}`,
    `Date: ${formatDayLong(l.event.date)}${l.event.startTime ? `, from ${l.event.startTime}` : ''}${l.event.endTime ? ` to ${l.event.endTime}` : ''}`,
    `Venue: ${l.event.venue}, ${l.event.city}, ${l.event.country}`,
    `Performance: ${format}`,
    '',
    `Fee: ${formatZar(q.totalCents)} (quote version ${q.version}${q.taxApplicable ? `, including VAT of ${formatZar(q.taxCents)}` : ''})`,
    `Deposit: ${formatZar(q.depositCents)}, due ${formatDayLong(q.depositDueDate)}. The date is secured only once the deposit is received and management confirms.`,
    `Balance: ${formatZar(q.balanceCents)}${q.balanceDueDate ? `, due ${formatDayLong(q.balanceDueDate)}` : ', due as set out in the quote'}.`,
    '',
    'Cancellation:',
    q.cancellationTerms,
    '',
    'Production, hospitality and travel requirements are as set out in the quote and the technical rider, which form part of this agreement.',
    '',
    'By signing, the client confirms they are authorised to enter into this agreement on behalf of the organisation named above.',
  ].join('\n');
}

async function issueContract(
  store: Store,
  l: Loaded,
  quote: Quote,
  actor: Actor,
  later: Later,
): Promise<Contract> {
  const existing = await store.list('contracts', { where: { bookingId: l.booking.id } });
  for (const c of existing)
    if (c.status === 'sent' || c.status === 'draft')
      await store.update('contracts', c.id, { status: 'void' });
  const terms = contractTerms(l, quote);
  const contract = await store.insert('contracts', {
    id: newId(),
    bookingId: l.booking.id,
    quoteId: quote.id,
    status: 'sent',
    terms,
    termsHash: sha256(terms),
    signerName: null,
    signerIpHash: null,
    signedAt: null,
    sentAt: now(),
    createdAt: now(),
  });
  await audit(store, actor, 'contract_issued', l.booking.id, {
    quote: quote.version,
    termsHash: contract.termsHash,
  });
  later.push(() => announce('contract_ready', l, { quote }));
  return contract;
}

export async function signContract(
  token: string,
  contractId: string,
  signerName: string,
  agreed: boolean,
  ip: string,
): Promise<void> {
  const p = await requirePortal(token);
  return atomic(async (store, later) => {
    const contract = await store.get('contracts', contractId);
    if (!contract || contract.bookingId !== p.booking.id)
      throw new BookingError('Agreement not found', 'not_found');
    if (contract.status !== 'sent')
      throw new BookingError('This agreement is not open for signature');
    const name = signerName.trim().replace(/\s+/g, ' ');
    if (!agreed)
      throw new BookingError('Tick the box to confirm you agree to the terms', 'validation');
    if (name.length < 3) throw new BookingError('Type your full name to sign', 'validation');
    const signedAt = now();
    await store.update('contracts', contract.id, {
      status: 'signed',
      signerName: name,
      signerIpHash: keyedHash(ip, 'signature-ip'),
      signedAt,
    });
    await audit(store, 'client', 'contract_signed', p.booking.id, {
      signer: name,
      termsHash: contract.termsHash,
    });
    const quote = await store.get('quotes', contract.quoteId);
    later.push(() => announce('contract_signed', p));
    if (quote) later.push(() => announce('deposit_requested', p, { quote }));
    later.push(() => trackServer('contract_signed', p.booking.id));
  });
}

// ── Payments ───────────────────────────────────────────────────────────────

export async function startPayment(token: string, kind: Payment['kind']): Promise<Checkout> {
  const store = getStore();
  const p = await requirePortal(token);
  const quote = p.quote;
  if (!quote || quote.status !== 'accepted')
    throw new BookingError('There is no accepted quote to pay against');
  if (kind === 'deposit') {
    if (p.booking.status !== 'AWAITING_DEPOSIT')
      throw new BookingError('A deposit is not due on this booking');
    if (p.contract?.status !== 'signed')
      throw new BookingError('Sign the agreement before paying the deposit');
    if (p.depositPaid) throw new BookingError('The deposit has already been paid');
  } else {
    if (p.booking.status !== 'CONFIRMED')
      throw new BookingError('The balance is payable once the booking is confirmed');
    if (p.balancePaid) throw new BookingError('The balance has already been paid');
  }
  const amountCents = kind === 'deposit' ? quote.depositCents : quote.balanceCents;
  if (amountCents <= 0) throw new BookingError('Nothing is due');

  const attempts = p.payments.filter((x) => x.kind === kind).length;
  const payment = await store.insert('payments', {
    id: newId(),
    bookingId: p.booking.id,
    quoteId: quote.id,
    kind,
    provider: getPaymentProvider().id,
    merchantReference: `${p.booking.reference}-${kind === 'deposit' ? 'D' : 'B'}${attempts + 1}`,
    providerReference: null,
    amountCents,
    currency: 'ZAR',
    status: 'pending',
    createdAt: now(),
    updatedAt: now(),
  });
  await audit(store, 'client', 'payment_started', p.booking.id, {
    kind,
    amount: amountCents,
    ref: payment.merchantReference,
  });

  const back = `/book/confirmation/${token}`;
  return getPaymentProvider().createCheckout({
    payment,
    booking: p.booking,
    customer: p.customer,
    itemName: `Zakes Bantwini — ${kind === 'deposit' ? 'deposit' : 'balance'} ${p.booking.reference}`,
    returnUrl: siteUrl(`${back}?payment=returned`),
    cancelUrl: siteUrl(`${back}?payment=cancelled`),
    notifyUrl: siteUrl(`/api/payments/${getPaymentProvider().id}/notify`),
  });
}

/**
 * Apply a provider notification. Idempotent: providers retry, and a payment
 * already complete is never re-announced. Never confirms a booking by itself —
 * confirmation stays a management action (brief §10 AVAILABILITY).
 */
export async function handlePaymentNotification(
  providerId: string,
  incoming: IncomingNotification,
): Promise<{ ok: boolean; reason?: string }> {
  const store = getStore();
  const provider = getPaymentProvider();
  if (provider.id !== providerId)
    return { ok: false, reason: `provider ${providerId} is not active` };

  const result = await provider.verifyNotification(incoming, async (ref) => {
    const payment = await store.findOne('payments', { merchantReference: ref });
    return payment ? { amountCents: payment.amountCents } : null;
  });
  if (!result.ok) {
    console.warn(`[payments] rejected ${providerId} notification: ${result.reason}`);
    return { ok: false, reason: result.reason };
  }

  return atomic(async (store, later) => {
    const payment = await store.findOne('payments', {
      merchantReference: result.merchantReference,
    });
    if (!payment) return { ok: false, reason: 'unknown payment' };
    if (payment.status === 'complete') return { ok: true };

    const updated = (await store.update('payments', payment.id, {
      status: result.status,
      providerReference: result.providerReference,
      updatedAt: now(),
    }))!;
    const l = await load(store, payment.bookingId);
    await audit(store, 'system', `payment_${result.status}`, payment.bookingId, {
      kind: payment.kind,
      ref: payment.merchantReference,
      provider: providerId,
    });

    if (result.status === 'complete') {
      later.push(() =>
        announce(payment.kind === 'deposit' ? 'deposit_received' : 'balance_received', l, {
          payment: updated,
        }),
      );
      if (payment.kind === 'deposit')
        later.push(() =>
          trackServer('deposit_paid', payment.bookingId, { amount: payment.amountCents }),
        );
    } else {
      later.push(() => announce('payment_failed', l, { payment: updated }));
    }
    return { ok: true };
  });
}

// ── Admin workflow ─────────────────────────────────────────────────────────

export async function adminChangeStatus(
  bookingId: string,
  to: BookingStatus,
  actor: Actor,
  note?: string,
): Promise<void> {
  requireRole(actor, MANAGE);
  if (to === 'CONFIRMED') return adminConfirmBooking(bookingId, actor, false);
  return atomic(async (store) => {
    const l = await load(store, bookingId);
    await setStatus(store, l, to, actor, note ? { note } : {});
  });
}

export async function adminHoldDate(
  bookingId: string,
  actor: Actor,
  days = HOLD_DAYS,
): Promise<void> {
  requireRole(actor, MANAGE);
  return atomic(async (store) => {
    const l = await load(store, bookingId);
    const holdExpiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
    l.booking.holdExpiresAt = holdExpiresAt;
    if (l.booking.status !== 'ON_HOLD') await setStatus(store, l, 'ON_HOLD', actor, { days });
    else await syncAvailability(store, l.booking, l.event, actor);
    await store.update('bookings', bookingId, { holdExpiresAt });
    await audit(store, actor, 'hold_placed', bookingId, { until: holdExpiresAt });
  });
}

export async function adminSaveQuote(
  bookingId: string,
  input: QuoteInputData,
  actor: Actor,
): Promise<Quote> {
  requireRole(actor, MANAGE);
  return atomic(async (store) => {
    const l = await load(store, bookingId);
    if (['CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(l.booking.status))
      throw new BookingError('Quotes cannot change once a booking is confirmed or closed');
    const totals = calculateQuote(input.lines, input);
    const quotes = await store.list('quotes', {
      where: { bookingId },
      orderBy: { field: 'version', dir: 'desc' },
    });
    const draft = quotes.find((q) => q.status === 'draft');
    const fields = { ...input, ...totals, currency: 'ZAR' as const };
    if (draft) {
      const saved = (await store.update('quotes', draft.id, fields))!;
      await audit(store, actor, 'quote_draft_updated', bookingId, {
        version: draft.version,
        total: totals.totalCents,
      });
      return saved;
    }
    const quote = await store.insert('quotes', {
      id: newId(),
      bookingId,
      version: (quotes[0]?.version ?? 0) + 1,
      status: 'draft',
      ...fields,
      clientResponseNote: null,
      createdAt: now(),
      sentAt: null,
      respondedAt: null,
    });
    await audit(store, actor, 'quote_drafted', bookingId, {
      version: quote.version,
      total: totals.totalCents,
    });
    return quote;
  });
}

export async function adminSendQuote(quoteId: string, actor: Actor): Promise<void> {
  requireRole(actor, MANAGE);
  return atomic(async (store, later) => {
    const quote = await store.get('quotes', quoteId);
    if (!quote) throw new BookingError('Quote not found', 'not_found');
    if (quote.status !== 'draft') throw new BookingError('Only a draft quote can be sent');
    const l = await load(store, quote.bookingId);
    if (quote.validUntil < todayIso())
      throw new BookingError('Set a “valid until” date in the future before sending');
    for (const q of await store.list('quotes', { where: { bookingId: quote.bookingId } })) {
      if (
        q.id !== quote.id &&
        (q.status === 'sent' || q.status === 'changes_requested' || q.status === 'accepted')
      ) {
        await store.update('quotes', q.id, { status: 'superseded' });
      }
    }
    if (l.booking.status === 'AWAITING_DEPOSIT') {
      for (const c of await store.list('contracts', { where: { bookingId: quote.bookingId } })) {
        if (c.status === 'sent') await store.update('contracts', c.id, { status: 'void' });
      }
    }
    const sent = (await store.update('quotes', quote.id, { status: 'sent', sentAt: now() }))!;
    if (l.booking.status !== 'QUOTE_SENT')
      await setStatus(store, l, 'QUOTE_SENT', actor, { quote: quote.version });
    await audit(store, actor, 'quote_sent', quote.bookingId, {
      version: quote.version,
      total: quote.totalCents,
    });
    later.push(() => announce('quote_ready', l, { quote: sent }));
  });
}

export async function adminReissueContract(bookingId: string, actor: Actor): Promise<void> {
  requireRole(actor, MANAGE);
  return atomic(async (store, later) => {
    const l = await load(store, bookingId);
    const quote = (await store.list('quotes', { where: { bookingId, status: 'accepted' } }))[0];
    if (!quote) throw new BookingError('The client has not accepted a quote yet');
    const signed = await store.findOne('contracts', { bookingId, status: 'signed' });
    if (signed) throw new BookingError('The agreement is already signed');
    await issueContract(store, l, quote, actor, later);
  });
}

export async function adminRecordManualPayment(
  bookingId: string,
  kind: Payment['kind'],
  amountCents: number,
  reference: string,
  actor: Actor,
): Promise<void> {
  requireRole(actor, MANAGE);
  return atomic(async (store, later) => {
    const l = await load(store, bookingId);
    const quote = (await store.list('quotes', { where: { bookingId, status: 'accepted' } }))[0];
    if (!quote) throw new BookingError('Record payments against an accepted quote');
    if (!Number.isInteger(amountCents) || amountCents <= 0)
      throw new BookingError('Enter the amount received', 'validation');
    const payment = await store.insert('payments', {
      id: newId(),
      bookingId,
      quoteId: quote.id,
      kind,
      provider: 'manual',
      merchantReference: `${l.booking.reference}-M-${Date.now().toString(36)}`,
      providerReference: reference.trim().slice(0, 120) || null,
      amountCents,
      currency: 'ZAR',
      status: 'complete',
      createdAt: now(),
      updatedAt: now(),
    });
    await audit(store, actor, 'payment_recorded', bookingId, {
      kind,
      amount: amountCents,
      reference,
    });
    later.push(() =>
      announce(kind === 'deposit' ? 'deposit_received' : 'balance_received', l, { payment }),
    );
    if (kind === 'deposit')
      later.push(() =>
        trackServer('deposit_paid', bookingId, { amount: amountCents, manual: true }),
      );
  });
}

/** Management's final confirmation. Requires a signed agreement and a paid deposit unless an owner overrides. */
export async function adminConfirmBooking(
  bookingId: string,
  actor: Actor,
  override: boolean,
  reason?: string,
): Promise<void> {
  requireRole(actor, MANAGE);
  return atomic(async (store, later) => {
    const l = await load(store, bookingId);
    const [signed, payments] = await Promise.all([
      store.findOne('contracts', { bookingId, status: 'signed' }),
      store.list('payments', { where: { bookingId, kind: 'deposit', status: 'complete' } }),
    ]);
    const missing = [
      !signed && 'a signed agreement',
      payments.length === 0 && 'a paid deposit',
    ].filter(Boolean) as string[];
    if (missing.length && !override)
      throw new BookingError(`Cannot confirm without ${missing.join(' and ')}`);
    if (missing.length && override) {
      requireRole(actor, ['owner']);
      if (!reason || reason.trim().length < 5)
        throw new BookingError(
          'Give a reason for confirming without the usual requirements',
          'validation',
        );
    }
    await setStatus(
      store,
      l,
      'CONFIRMED',
      actor,
      override ? { override: true, reason, missing } : {},
    );
    later.push(
      () => announce('booking_confirmed', l),
      () => trackServer('booking_confirmed', bookingId),
    );
  });
}

export async function adminAddNote(bookingId: string, actor: Actor, body: string): Promise<void> {
  if (typeof actor === 'string') throw new BookingError('Notes are for management', 'forbidden');
  const store = getStore();
  const text = body.trim();
  if (!text) throw new BookingError('Write a note first', 'validation');
  await store.insert('internal_notes', {
    id: newId(),
    bookingId,
    authorId: actor.id,
    authorName: actor.name,
    body: text.slice(0, 4000),
    createdAt: now(),
  });
  await audit(store, actor, 'note_added', bookingId);
}

export async function adminUploadDocument(
  bookingId: string,
  file: UploadedFile,
  kind: DocumentRecord['kind'],
  clientVisible: boolean,
  actor: Actor,
): Promise<void> {
  requireRole(actor, MANAGE);
  return atomic(async (store) => {
    await load(store, bookingId);
    const doc = await storeDocument(store, bookingId, file, kind, 'admin', clientVisible);
    await audit(store, actor, 'document_uploaded', bookingId, {
      kind,
      filename: doc.filename,
      clientVisible,
    });
  });
}

export async function adminSetAvailability(
  date: string,
  state: AvailabilityState,
  note: string | null,
  actor: Actor,
): Promise<void> {
  requireRole(actor, MANAGE);
  return atomic(async (store) => {
    const existing = await store.get('availability', date);
    if (existing?.bookingId) {
      const booking = await store.get('bookings', existing.bookingId);
      if (booking && availabilityFor(booking.status)) {
        throw new BookingError(
          `${formatDayLong(date)} is held by ${booking.reference}. Change that booking instead.`,
          'conflict',
        );
      }
    }
    if (state === 'AVAILABLE') await store.remove('availability', date);
    else
      await store.upsert('availability', {
        date,
        state,
        bookingId: null,
        note,
        updatedAt: now(),
        updatedBy: actorName(actor),
      });
    await audit(store, actor, 'availability_set', null, { date, state, note });
  });
}

// ── Scheduled jobs ─────────────────────────────────────────────────────────

/**
 * Daily job (POST /api/cron/reminders): release expired holds, send balance
 * reminders 7 and 1 days before the balance is due, and event reminders 14
 * and 2 days before the event. Each reminder is sent once per day at most.
 */
export async function runScheduledJobs(
  today = todayIso(),
): Promise<{ released: number; reminders: number }> {
  const store = getStore();
  let released = 0;
  let reminders = 0;

  for (const booking of await store.list('bookings', { where: { status: 'ON_HOLD' } })) {
    if (booking.holdExpiresAt && booking.holdExpiresAt < new Date().toISOString()) {
      await atomic(async (tx) => {
        const l = await load(tx, booking.id);
        await setStatus(tx, l, 'IN_REVIEW', 'system', { reason: 'hold expired' });
      });
      released++;
    }
  }

  const sentToday = async (bookingId: string, e: NotificationEvent) =>
    (await store.list('notifications', { where: { bookingId, event: e } })).some(
      (n) => n.createdAt.slice(0, 10) === today,
    );

  for (const booking of await store.list('bookings', { where: { status: 'CONFIRMED' } })) {
    const l = await load(store, booking.id);
    const quote = (
      await store.list('quotes', { where: { bookingId: booking.id, status: 'accepted' } })
    )[0];
    const balancePaid =
      (await store.count('payments', {
        where: { bookingId: booking.id, kind: 'balance', status: 'complete' },
      })) > 0;
    if (
      quote?.balanceDueDate &&
      !balancePaid &&
      quote.balanceCents > 0 &&
      [7, 1].includes(daysBetween(today, quote.balanceDueDate))
    ) {
      if (!(await sentToday(booking.id, 'balance_reminder'))) {
        await announce('balance_reminder', l, { quote });
        reminders++;
      }
    }
    if (
      [14, 2].includes(daysBetween(today, l.event.date)) &&
      !(await sentToday(booking.id, 'event_reminder'))
    ) {
      await announce('event_reminder', l);
      reminders++;
    }
  }
  return { released, reminders };
}
