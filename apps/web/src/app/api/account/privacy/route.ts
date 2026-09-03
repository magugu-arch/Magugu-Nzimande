import { NextResponse } from 'next/server';
import { currentAccount, refuseUnlessSignedIn, signOutCookie } from '@/lib/accounts/session';
import { eraseAccount, exportAccount } from '@/lib/accounts/store';

/**
 * Data-subject requests, as the Protection of Personal Information Act gives
 * them: access (§23) and deletion (§24).
 *
 * Engineering, not compliance. A lawyer still has to write the policy, decide
 * the retention periods and name the information officer — that review is not
 * something this file can do, and the readiness document still lists it as
 * outstanding. What is here is the part that has to exist before any of those
 * answers can be honoured: a way to hand somebody everything held about them,
 * and a way to erase them that does not also destroy the business records a
 * different law requires be kept.
 */

/** GET /api/account/privacy — everything held about the signed-in customer. */
export function GET(request: Request) {
  const refusal = refuseUnlessSignedIn(request);
  if (refusal) return refusal;

  const account = currentAccount(request);
  if (!account) return NextResponse.json({ error: 'Sign in to do that.' }, { status: 401 });

  const data = exportAccount(account.id);
  if (!data) return NextResponse.json({ error: 'No such account' }, { status: 404 });

  return NextResponse.json(data, {
    headers: {
      // Offered as a file, because a subject access request that arrives as a
      // wall of JSON in a browser tab is technically a response and not
      // practically one.
      'content-disposition': `attachment; filename="bbq-chicken-my-data.json"`,
    },
  });
}

/**
 * DELETE /api/account/privacy — erases the customer.
 *
 * The account and its addresses go. The orders stay, unlinked and with the
 * customer's details replaced: a completed sale is a record the business is
 * required to keep, and honouring one obligation by breaking another is not
 * compliance. What survives is a transaction with nobody attached to it.
 */
export function DELETE(request: Request) {
  const refusal = refuseUnlessSignedIn(request);
  if (refusal) return refusal;

  const account = currentAccount(request);
  if (!account) return NextResponse.json({ error: 'Sign in to do that.' }, { status: 401 });

  const erased = eraseAccount(account.id);
  if (!erased) return NextResponse.json({ error: 'No such account' }, { status: 404 });

  // The cookie goes with the account. Without this the session outlives the
  // customer it names — harmless, because the lookup fails, but it would leave
  // somebody looking at a signed-in interface belonging to nobody.
  return NextResponse.json(
    { erased: true, ordersRetained: true },
    { headers: { 'set-cookie': signOutCookie() } },
  );
}
