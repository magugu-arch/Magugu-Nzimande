/**
 * Payment ↔ booking reconciliation and settlement export (brief §13.3,
 * §13.11). Lists every record where money and tables disagree so staff can
 * act, and produces the settlement file finance reconciles against the
 * gateway's own report.
 */

import type { Ctx } from '../context.ts';
import { MINUTE, formatZar } from '../util/core.ts';
import { isSettledSuccess } from './stateMachine.ts';

export interface Mismatch {
  id: string;
  kind:
    | 'paid-no-table'
    | 'table-no-deposit'
    | 'refund-overdue'
    | 'refund-owed-not-issued'
    | 'event-paid-not-confirmed';
  severity: 'warning' | 'critical';
  summary: string;
  amountMinor: number;
  entityType: string;
  entityId: string;
}

export function reconciliationReport(ctx: Ctx): Mismatch[] {
  const { db, clock } = ctx;
  const now = clock.now();
  const out: Mismatch[] = [];

  for (const a of db.where('bookingAttempts', (x) => x.paymentId !== null)) {
    const p = db.get('payments', a.paymentId!);
    if (!p) continue;
    const net = p.amountMinor - p.refundedMinor;
    if (isSettledSuccess(p.status) && net > 0 && !['confirmed', 'pending-payment', 'requested'].includes(a.state)) {
      const pendingRefund = db.where('refunds', (r) => r.paymentId === p.id && r.status === 'pending').length > 0;
      if (!pendingRefund) {
        out.push({
          id: `paid-no-table:${a.id}`,
          kind: 'paid-no-table',
          severity: 'critical',
          summary: `Deposit ${formatZar(net)} held with no confirmed table (attempt ${a.state}).`,
          amountMinor: net,
          entityType: 'attempt',
          entityId: a.id,
        });
      }
    }
  }

  for (const b of db.where('bookings', (x) => x.depositAmountMinor > 0 && ['confirmed', 'amended'].includes(x.status))) {
    const paid = b.paymentIds.map((id) => db.get('payments', id)).filter((p) => p && isSettledSuccess(p.status));
    if (paid.length === 0) {
      out.push({
        id: `table-no-deposit:${b.id}`,
        kind: 'table-no-deposit',
        severity: 'warning',
        summary: `Booking ${b.reference} needs a ${formatZar(b.depositAmountMinor)} deposit but has no verified payment.`,
        amountMinor: b.depositAmountMinor,
        entityType: 'booking',
        entityId: b.id,
      });
    }
  }

  for (const r of db.where('refunds', (x) => x.status === 'pending' && now - x.createdAt > 15 * MINUTE)) {
    out.push({
      id: `refund-overdue:${r.id}`,
      kind: 'refund-overdue',
      severity: 'warning',
      summary: `Refund of ${formatZar(r.amountMinor)} still pending at the gateway after 15 minutes.`,
      amountMinor: r.amountMinor,
      entityType: 'payment',
      entityId: r.paymentId,
    });
  }

  for (const b of db.where('bookings', (x) => x.depositRefundedMinor > 0)) {
    const issued = db
      .where('refunds', (r) => b.paymentIds.includes(r.paymentId) && r.status !== 'failed')
      .reduce((n, r) => n + r.amountMinor, 0);
    if (issued < b.depositRefundedMinor) {
      out.push({
        id: `refund-owed:${b.id}`,
        kind: 'refund-owed-not-issued',
        severity: 'critical',
        summary: `Booking ${b.reference} owes ${formatZar(b.depositRefundedMinor - issued)} in refunds not yet issued.`,
        amountMinor: b.depositRefundedMinor - issued,
        entityType: 'booking',
        entityId: b.id,
      });
    }
  }

  for (const e of db.where('eventBookings', (x) => x.status === 'failed' && x.paymentId !== null)) {
    const p = db.get('payments', e.paymentId!);
    if (p && p.status === 'succeeded') {
      out.push({
        id: `event-paid:${e.id}`,
        kind: 'event-paid-not-confirmed',
        severity: 'critical',
        summary: `Event place ${e.reference} paid ${formatZar(p.amountMinor)} but not confirmed; refund due.`,
        amountMinor: p.amountMinor,
        entityType: 'eventBooking',
        entityId: e.id,
      });
    }
  }

  return out;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function settlementCsv(ctx: Ctx): string {
  const header = [
    'payment_id',
    'gateway_reference',
    'purpose',
    'reference_id',
    'status',
    'currency',
    'amount_minor',
    'refunded_minor',
    'net_minor',
    'created_at',
    'updated_at',
  ];
  const rows = ctx.db
    .all('payments')
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((p) => [
      p.id,
      p.gatewayReference ?? '',
      p.purpose,
      p.referenceId,
      p.status,
      p.currency,
      p.amountMinor,
      p.refundedMinor,
      isSettledSuccess(p.status) || p.status === 'refunded' ? p.amountMinor - p.refundedMinor : 0,
      new Date(p.createdAt).toISOString(),
      new Date(p.updatedAt).toISOString(),
    ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}
