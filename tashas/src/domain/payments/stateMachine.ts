/**
 * Payment states (brief §13.3). The sandbox gateway maps onto these directly;
 * a real gateway adapter maps its own states here and documents the mapping.
 */

import type { PaymentStatus } from '../types.ts';

const NEXT: Record<PaymentStatus, PaymentStatus[]> = {
  created: ['pending', 'requires-action', 'authorised', 'succeeded', 'failed', 'cancelled'],
  pending: ['requires-action', 'authorised', 'succeeded', 'failed', 'cancelled'],
  'requires-action': ['pending', 'authorised', 'succeeded', 'failed', 'cancelled'],
  authorised: ['succeeded', 'failed', 'cancelled'],
  succeeded: ['refund-pending', 'partially-refunded', 'refunded'],
  'refund-pending': ['partially-refunded', 'refunded', 'succeeded'],
  'partially-refunded': ['refund-pending', 'partially-refunded', 'refunded'],
  refunded: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return NEXT[from].includes(to);
}

export function isSettledSuccess(status: PaymentStatus): boolean {
  return status === 'succeeded' || status === 'refund-pending' || status === 'partially-refunded';
}

export function isTerminalFailure(status: PaymentStatus): boolean {
  return status === 'failed' || status === 'cancelled';
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  created: 'Created',
  pending: 'Waiting for payment',
  'requires-action': 'Waiting for bank authentication',
  authorised: 'Authorised',
  succeeded: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
  'refund-pending': 'Refund in progress',
  'partially-refunded': 'Partly refunded',
  refunded: 'Refunded',
};
