import { PasswordSchema, z } from '@bbq/types';
import { NextResponse } from 'next/server';
import { completeReset, requestReset } from '@/lib/accounts/reset';
import { areAccountsConfigured } from '@/lib/accounts/session';
import { findById } from '@/lib/accounts/store';
import { notifyPasswordReset } from '@/lib/notifications/send';

/**
 * Password reset.
 *
 * POST asks for one; PUT spends it. The token itself never appears in either
 * response — it goes out through the notification seam, which on this
 * deployment writes to the audit log rather than to an inbox. Returning it to
 * the caller would make the endpoint a way to take over any account by naming
 * its address, which is the whole thing a reset flow exists to prevent.
 */

const RequestSchema = z.object({ email: z.email() });
const CompleteSchema = z.object({ token: z.string().min(1), password: PasswordSchema });

/** The same answer whether or not anybody has that address. */
const ACKNOWLEDGED = { sent: true } as const;

export async function POST(request: Request) {
  if (!areAccountsConfigured()) {
    return NextResponse.json({ error: 'Accounts are not configured' }, { status: 503 });
  }

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  // Even a malformed address is acknowledged rather than corrected, so the
  // shape of the reply cannot be used to sort real addresses from invented ones.
  if (!parsed.success) return NextResponse.json(ACKNOWLEDGED);

  const reset = requestReset(parsed.data.email);
  if (reset) {
    const account = findById(reset.accountId);
    if (account) await notifyPasswordReset(account.email, reset.token);
  }

  return NextResponse.json(ACKNOWLEDGED);
}

export async function PUT(request: Request) {
  if (!areAccountsConfigured()) {
    return NextResponse.json({ error: 'Accounts are not configured' }, { status: 503 });
  }

  const parsed = CompleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Choose a password of at least 10 characters' },
      { status: 400 },
    );
  }

  const result = completeReset(parsed.data.token, parsed.data.password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  // Deliberately does not sign them in. Someone who has the link but not the
  // inbox should have to prove they know the password they just set.
  return NextResponse.json({ reset: true });
}
