'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { acceptQuote, BookingError, requestQuoteChanges, signContract, startPayment } from '@/lib/booking/service';
import { PaymentsNotConfigured, type Checkout } from '@/lib/payments';
import { clientIp } from '@/lib/security/rate-limit';

export type PortalActionState = { ok: boolean; message: string | null };

function failure(error: unknown): PortalActionState {
  if (error instanceof BookingError) return { ok: false, message: error.message };
  if (error instanceof PaymentsNotConfigured) return { ok: false, message: 'Online payment is not available right now. The booking team will send payment details directly.' };
  console.error('[portal] action failed', error);
  return { ok: false, message: 'Something went wrong on our side. Nothing was changed — please try again.' };
}

function refresh(token: string) {
  revalidatePath(`/book/confirmation/${token}`);
  revalidatePath(`/book/quote/${token}`);
}

/** On success, go straight to the booking page — the agreement is waiting there. */
export async function acceptQuoteAction(token: string, quoteId: string): Promise<PortalActionState> {
  try {
    await acceptQuote(token, quoteId);
  } catch (error) {
    return failure(error);
  }
  refresh(token);
  redirect(`/book/confirmation/${token}?accepted=1`);
}

export async function requestChangesAction(token: string, quoteId: string, _prev: PortalActionState, form: FormData): Promise<PortalActionState> {
  try {
    await requestQuoteChanges(token, quoteId, String(form.get('note') ?? ''));
    refresh(token);
    return { ok: true, message: 'Thank you — the booking team will review your note and send an updated quote.' };
  } catch (error) {
    return failure(error);
  }
}

export async function signContractAction(token: string, contractId: string, _prev: PortalActionState, form: FormData): Promise<PortalActionState> {
  try {
    const ip = clientIp(await headers());
    await signContract(token, contractId, String(form.get('signerName') ?? ''), form.get('agree') === 'on', ip);
    refresh(token);
    return { ok: true, message: 'Agreement signed. The final step is the deposit.' };
  } catch (error) {
    return failure(error);
  }
}

export async function startPaymentAction(token: string, kind: 'deposit' | 'balance'): Promise<{ checkout: Checkout | null; message: string | null }> {
  try {
    return { checkout: await startPayment(token, kind), message: null };
  } catch (error) {
    return { checkout: null, message: failure(error).message };
  }
}
