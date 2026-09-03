import { SignInRequestSchema } from '@bbq/types';
import { NextResponse } from 'next/server';
import {
  areAccountsConfigured,
  currentAccount,
  signInCookie,
  signOutCookie,
} from '@/lib/accounts/session';
import { authenticate, publicView } from '@/lib/accounts/store';

/** GET /api/account/session — who, if anyone, this request is. */
export function GET(request: Request) {
  const account = currentAccount(request);
  if (!account) return NextResponse.json({ account: null }, { status: 200 });
  return NextResponse.json({ account });
}

/**
 * POST /api/account/session — signs in.
 *
 * One message for every failure. "No such account" and "wrong password" are the
 * same reply with the same status, and `authenticate` spends the same time on
 * both, so the endpoint cannot be used to find out which email addresses are
 * customers here.
 */
export async function POST(request: Request) {
  if (!areAccountsConfigured()) {
    return NextResponse.json({ error: 'Accounts are not configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body' }, { status: 400 });
  }

  const parsed = SignInRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your email and password' }, { status: 400 });
  }

  const account = authenticate(parsed.data.email, parsed.data.password);
  if (!account) {
    return NextResponse.json({ error: 'That email and password do not match' }, { status: 401 });
  }

  const cookie = signInCookie(account.id);
  if (!cookie) {
    return NextResponse.json({ error: 'Accounts are not configured' }, { status: 503 });
  }

  return NextResponse.json(
    { account: publicView(account) },
    { headers: { 'set-cookie': cookie } },
  );
}

/** DELETE /api/account/session — signs out. Safe to call when not signed in. */
export function DELETE() {
  return NextResponse.json({ signedOut: true }, { headers: { 'set-cookie': signOutCookie() } });
}
