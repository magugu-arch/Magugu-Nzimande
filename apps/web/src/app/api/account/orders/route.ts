import { NextResponse } from 'next/server';
import { currentAccount, refuseUnlessSignedIn } from '@/lib/accounts/session';
import { ordersForAccount } from '@/lib/order-store';

/**
 * GET /api/account/orders — this customer's order history.
 *
 * Filtered by the account id on the session, never by one in the query string.
 * An endpoint that takes whose orders to return as a parameter is an endpoint
 * that returns anybody's.
 */
export function GET(request: Request) {
  const refusal = refuseUnlessSignedIn(request);
  if (refusal) return refusal;

  const account = currentAccount(request);
  if (!account) return NextResponse.json({ error: 'Sign in to do that.' }, { status: 401 });

  return NextResponse.json({ orders: ordersForAccount(account.id) });
}
