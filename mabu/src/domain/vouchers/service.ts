import type { ServiceContext } from '../context';
import { audit, nowIso, requireFlag, requireOwnerOrStaff, requireRole } from '../context';
import type { Actor } from '../guests/types';
import type { PaymentsService } from '../payments/service';
import { DomainError } from '../shared/errors';
import { idempotent } from '../shared/idempotency';
import { cleanNote, isEmail } from '../shared/validation';
import {
  DEFAULT_VOUCHER_POLICY,
  type Voucher,
  type VoucherPolicy,
  type VoucherRedemption,
} from './types';

export interface VoucherPurchaseInput {
  amountCents: number;
  forSelf: boolean;
  recipientName: string;
  recipientEmail: string;
  message?: string;
  occasion?: string;
  delivery: 'email' | 'in-app';
  methodToken: string;
  idempotencyKey: string;
}

/** The QR payload. Just the code — the QR carries nothing a photo of it would leak. */
export function voucherQrPayload(code: string): string {
  return `MABU:VOUCHER:${code}`;
}

/**
 * Digital gift vouchers (§12): purchase, issue, deliver, redeem (in part or in
 * full), expire and cancel — with a pending state when payment has not
 * settled, and replay protection on redemption.
 */
export class VouchersService {
  constructor(
    private readonly ctx: ServiceContext,
    private readonly payments: PaymentsService,
  ) {
    payments.onSettled('voucher', async (intent) => {
      const v = this.ctx.db.vouchers.get(intent.referenceId);
      if (!v || v.status !== 'pending_payment') return;
      if (intent.status === 'succeeded') await this.activate(v);
      else this.ctx.db.vouchers.update(v.id, { status: 'cancelled', updatedAt: nowIso(this.ctx) });
    });
  }

  policy(): VoucherPolicy {
    return this.ctx.db.voucherPolicy.get('voucher-policy') ?? DEFAULT_VOUCHER_POLICY;
  }

  updatePolicy(patch: Partial<Omit<VoucherPolicy, 'id'>>, actor: Actor): VoucherPolicy {
    requireRole(actor, 'admin');
    const next = {
      ...this.policy(),
      ...patch,
      id: 'voucher-policy' as const,
      updatedAt: nowIso(this.ctx),
    };
    if (next.expiryMonths < 36) {
      throw new DomainError(
        'VALIDATION',
        'South African law (CPA s63) requires vouchers to stay valid for at least 36 months.',
        'expiry below CPA minimum',
      );
    }
    this.ctx.db.voucherPolicy.upsert(next);
    audit(this.ctx, actor, 'voucher_policy.updated', 'voucher_policy', next.id, patch);
    return next;
  }

  validateAmount(amountCents: number): void {
    const p = this.policy();
    if (p.presetsCents.includes(amountCents)) return;
    if (!p.customEnabled) {
      throw new DomainError('VALIDATION', 'Please choose one of the voucher values.', 'not preset');
    }
    if (!Number.isInteger(amountCents) || amountCents < p.minCents || amountCents > p.maxCents) {
      throw new DomainError(
        'VALIDATION',
        `Vouchers can be from R${p.minCents / 100} to R${p.maxCents / 100}.`,
        'amount bounds',
      );
    }
    if (amountCents % 100 !== 0) {
      throw new DomainError('VALIDATION', 'Please choose a whole rand amount.', 'cents');
    }
  }

  async purchase(input: VoucherPurchaseInput, actor: Actor): Promise<Voucher> {
    requireFlag(this.ctx.flags.vouchersEnabled, 'vouchers');
    requireRole(actor, 'guest', 'staff', 'admin');
    const { methodToken, ...fingerprint } = input;
    const id = await idempotent(
      this.ctx.db,
      `voucher.purchase:${actor.id}`,
      input.idempotencyKey,
      fingerprint,
      nowIso(this.ctx),
      async () => {
        this.validateAmount(input.amountCents);
        const purchaser = this.ctx.db.guests.require(actor.id, 'guest');
        const recipientName = input.forSelf ? purchaser.name : input.recipientName.trim();
        const recipientEmail = (input.forSelf ? purchaser.email : input.recipientEmail)
          .trim()
          .toLowerCase();
        if (!recipientName)
          throw new DomainError('VALIDATION', 'Who is the voucher for?', 'recipient');
        if (!isEmail(recipientEmail)) {
          throw new DomainError(
            'VALIDATION',
            "Please enter the recipient's email address.",
            'email',
          );
        }
        this.ctx.analytics.track('voucher_purchase_started', { amountCents: input.amountCents });
        const now = nowIso(this.ctx);
        const voucher = this.ctx.db.vouchers.insert({
          id: this.ctx.ids.id('vch'),
          code: `MABU-${this.ctx.ids.code(4)}-${this.ctx.ids.code(4)}`,
          amountCents: input.amountCents,
          remainingCents: input.amountCents,
          status: 'pending_payment',
          purchaserGuestId: purchaser.id,
          issuedTo: input.forSelf
            ? purchaser.id
            : this.ctx.db.guests.find((g) => g.email === recipientEmail)?.id,
          recipientName,
          recipientEmail,
          forSelf: input.forSelf,
          message: cleanNote(input.message, 250),
          occasion: cleanNote(input.occasion, 60),
          delivery: input.delivery,
          createdAt: now,
          updatedAt: now,
        });
        const intent = await this.payments.charge({
          purpose: 'voucher',
          referenceId: voucher.id,
          amountCents: voucher.amountCents,
          description: 'Mábu gift voucher',
          methodToken,
          idempotencyKey: `${input.idempotencyKey}:pay`,
        });
        this.ctx.db.vouchers.update(voucher.id, { paymentId: intent.id });
        if (intent.status === 'failed') {
          this.ctx.db.vouchers.update(voucher.id, {
            status: 'cancelled',
            updatedAt: nowIso(this.ctx),
          });
          throw new DomainError(
            'PAYMENT_DECLINED',
            intent.failureReason ?? 'The payment did not go through. No money was taken.',
            'declined',
          );
        }
        // §23: payment taken but not yet confirmed → stay pending and reconcile.
        if (intent.status === 'succeeded')
          await this.activate(this.ctx.db.vouchers.require(voucher.id));
        return voucher.id;
      },
    );
    return this.ctx.db.vouchers.require(id, 'voucher');
  }

  private async activate(v: Voucher): Promise<void> {
    const issuedAt = nowIso(this.ctx);
    const expires = new Date(issuedAt);
    expires.setUTCMonth(expires.getUTCMonth() + this.policy().expiryMonths);
    this.ctx.db.vouchers.update(v.id, {
      status: 'active',
      issuedAt,
      expiresAt: expires.toISOString(),
      updatedAt: issuedAt,
    });
    this.ctx.analytics.track('voucher_purchase_completed', { amountCents: v.amountCents });
    await this.ctx.bus.publish({
      type: 'voucher.purchased',
      voucherId: v.id,
      guestId: v.purchaserGuestId,
      amountCents: v.amountCents,
    });
  }

  /** Purchased by, or given to, this guest. */
  listForGuest(guestId: string, actor: Actor): Voucher[] {
    requireOwnerOrStaff(actor, guestId);
    const guest = this.ctx.db.guests.get(guestId);
    return (
      this.ctx.db.vouchers
        // A purchase whose payment was declined never became a voucher; hide it.
        .filter((v) => !(v.status === 'cancelled' && !v.issuedAt))
        .filter(
          (v) =>
            v.purchaserGuestId === guestId ||
            v.issuedTo === guestId ||
            (!!guest && v.recipientEmail === guest.email && v.status !== 'pending_payment'),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  }

  get(voucherId: string, actor: Actor): Voucher {
    const v = this.ctx.db.vouchers.require(voucherId, 'voucher');
    const guest = this.ctx.db.guests.get(actor.id);
    if (
      actor.role === 'guest' &&
      v.purchaserGuestId !== actor.id &&
      v.issuedTo !== actor.id &&
      v.recipientEmail !== guest?.email
    ) {
      throw new DomainError('NOT_FOUND', 'We could not find that voucher.', 'owner');
    }
    return v;
  }

  /* ── Staff ──────────────────────────────────────────────────────────── */

  lookup(code: string, actor: Actor): { voucher: Voucher; redemptions: VoucherRedemption[] } {
    requireRole(actor, 'staff', 'admin');
    const normalised = code
      .trim()
      .toUpperCase()
      .replace(/^MABU:VOUCHER:/, '');
    const voucher = this.ctx.db.vouchers.find((v) => v.code === normalised);
    if (!voucher)
      throw new DomainError('NOT_FOUND', 'That voucher code was not recognised.', normalised);
    return {
      voucher,
      redemptions: this.ctx.db.voucherRedemptions.filter((r) => r.voucherId === voucher.id),
    };
  }

  async redeem(
    code: string,
    amountCents: number,
    idempotencyKey: string,
    actor: Actor,
    note?: string,
  ): Promise<Voucher> {
    requireRole(actor, 'staff', 'admin');
    const { voucher } = this.lookup(code, actor);
    await idempotent(
      this.ctx.db,
      `voucher.redeem:${voucher.id}`,
      idempotencyKey,
      { amountCents },
      nowIso(this.ctx),
      async () => {
        const v = this.ctx.db.vouchers.require(voucher.id);
        if (v.status === 'redeemed') {
          throw new DomainError('ALREADY_REDEEMED', 'This voucher has been fully used.', v.id);
        }
        if (v.status !== 'active')
          throw new DomainError('EXPIRED', `This voucher is ${v.status.replace('_', ' ')}.`, v.id);
        if (v.expiresAt && new Date(v.expiresAt) <= this.ctx.clock.now()) {
          this.ctx.db.vouchers.update(v.id, { status: 'expired' });
          throw new DomainError('EXPIRED', 'This voucher has expired.', v.id);
        }
        if (!Number.isInteger(amountCents) || amountCents <= 0) {
          throw new DomainError('VALIDATION', 'Enter the amount to redeem.', 'amount');
        }
        if (amountCents > v.remainingCents) {
          throw new DomainError(
            'VALIDATION',
            `Only R${(v.remainingCents / 100).toFixed(2)} remains on this voucher.`,
            'over balance',
          );
        }
        const remainingCents = v.remainingCents - amountCents;
        this.ctx.db.vouchers.update(v.id, {
          remainingCents,
          status: remainingCents === 0 ? 'redeemed' : 'active',
          updatedAt: nowIso(this.ctx),
        });
        this.ctx.db.voucherRedemptions.insert({
          id: this.ctx.ids.id('vrd'),
          voucherId: v.id,
          amountCents,
          staffId: actor.id,
          idempotencyKey,
          note: cleanNote(note, 200),
          at: nowIso(this.ctx),
        });
        audit(this.ctx, actor, 'voucher.redeemed', 'voucher', v.id, {
          amountCents,
          remainingCents,
        });
        await this.ctx.bus.publish({
          type: 'voucher.redeemed',
          voucherId: v.id,
          guestId: v.issuedTo ?? v.purchaserGuestId,
          amountCents,
        });
        return v.id;
      },
    );
    return this.ctx.db.vouchers.require(voucher.id);
  }

  async cancel(voucherId: string, reason: string, actor: Actor): Promise<Voucher> {
    requireRole(actor, 'admin');
    const v = this.ctx.db.vouchers.require(voucherId, 'voucher');
    if (v.status === 'cancelled') return v;
    if (v.remainingCents !== v.amountCents) {
      throw new DomainError('CONFLICT', 'A part-used voucher cannot be cancelled.', v.id);
    }
    if (v.paymentId) await this.payments.refund(v.paymentId);
    const updated = this.ctx.db.vouchers.update(v.id, {
      status: 'cancelled',
      updatedAt: nowIso(this.ctx),
    });
    audit(this.ctx, actor, 'voucher.cancelled', 'voucher', v.id, { reason });
    return updated;
  }

  /** Job: lapse vouchers past their date. */
  expireDue(): number {
    const now = this.ctx.clock.now();
    let n = 0;
    for (const v of this.ctx.db.vouchers.filter(
      (x) => x.status === 'active' && !!x.expiresAt && new Date(x.expiresAt) <= now,
    )) {
      this.ctx.db.vouchers.update(v.id, { status: 'expired', updatedAt: nowIso(this.ctx) });
      n += 1;
    }
    return n;
  }

  report(actor: Actor) {
    requireRole(actor, 'staff', 'admin');
    const all = this.ctx.db.vouchers.list();
    const sold = all.filter((v) => v.status !== 'pending_payment' && v.status !== 'cancelled');
    return {
      soldCount: sold.length,
      soldCents: sold.reduce((s, v) => s + v.amountCents, 0),
      outstandingCents: sold
        .filter((v) => v.status === 'active')
        .reduce((s, v) => s + v.remainingCents, 0),
      redeemedCents: this.ctx.db.voucherRedemptions.list().reduce((s, r) => s + r.amountCents, 0),
      pending: all.filter((v) => v.status === 'pending_payment').length,
    };
  }
}
