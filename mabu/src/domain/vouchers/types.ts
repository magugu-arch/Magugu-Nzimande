/** Vouchers — brief §12 and §21. */

export type VoucherStatus = 'pending_payment' | 'active' | 'redeemed' | 'expired' | 'cancelled';

export interface Voucher {
  id: string;
  code: string;
  amountCents: number;
  remainingCents: number;
  status: VoucherStatus;
  purchaserGuestId: string;
  /** Guest id of the recipient once known; email until then. */
  issuedTo?: string;
  recipientName: string;
  recipientEmail: string;
  forSelf: boolean;
  message?: string;
  occasion?: string;
  delivery: 'email' | 'in-app';
  paymentId?: string;
  issuedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherRedemption {
  id: string;
  voucherId: string;
  amountCents: number;
  staffId: string;
  idempotencyKey: string;
  note?: string;
  at: string;
}

/**
 * Voucher rules as data. The expiry default is 36 months because the
 * Consumer Protection Act (s63) sets three years as the minimum validity for
 * prepaid certificates in South Africa; Mábu may choose longer, not shorter.
 */
export interface VoucherPolicy {
  id: 'voucher-policy';
  presetsCents: number[];
  customEnabled: boolean;
  minCents: number;
  maxCents: number;
  expiryMonths: number;
  terms: string;
  updatedAt: string;
}

export const DEFAULT_VOUCHER_POLICY: VoucherPolicy = {
  id: 'voucher-policy',
  presetsCents: [50000, 100000, 150000, 250000],
  customEnabled: true,
  minCents: 25000,
  maxCents: 1000000,
  expiryMonths: 36,
  terms:
    'Valid for dining at Mábu Restaurant, Waterfall Wilds, for 36 months from issue. May be used over more than one visit. Not exchangeable for cash. Present the code or QR when settling the bill.',
  updatedAt: '2026-09-01T00:00:00+02:00',
};
