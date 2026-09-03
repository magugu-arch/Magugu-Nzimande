import { NewAddressSchema } from '@bbq/types';
import { NextResponse } from 'next/server';
import { currentAccount, refuseUnlessSignedIn } from '@/lib/accounts/session';
import { addressesFor, removeAddress, saveAddress } from '@/lib/accounts/store';

/**
 * The customer's address book.
 *
 * Every handler resolves the account from the session and scopes the write to
 * it. There is no address id that belongs to nobody: deleting one that is not
 * yours answers 404, the same as deleting one that does not exist, so the
 * endpoint cannot be used to find out which ids are real.
 */

export function GET(request: Request) {
  const refusal = refuseUnlessSignedIn(request);
  if (refusal) return refusal;

  const account = currentAccount(request);
  return NextResponse.json({ addresses: account ? addressesFor(account.id) : [] });
}

export async function POST(request: Request) {
  const refusal = refuseUnlessSignedIn(request);
  if (refusal) return refusal;

  const account = currentAccount(request);
  if (!account) return NextResponse.json({ error: 'Sign in to do that.' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body' }, { status: 400 });
  }

  const parsed = NewAddressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Check the address' }, { status: 400 });
  }

  const address = saveAddress(account.id, parsed.data);
  if (!address) return NextResponse.json({ error: 'Sign in to do that.' }, { status: 401 });

  return NextResponse.json({ address }, { status: 201 });
}

export async function DELETE(request: Request) {
  const refusal = refuseUnlessSignedIn(request);
  if (refusal) return refusal;

  const account = currentAccount(request);
  if (!account) return NextResponse.json({ error: 'Sign in to do that.' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Name the address to remove' }, { status: 400 });

  // Scoped to this account, so a guessed id belonging to somebody else is a
  // miss rather than a deletion.
  if (!removeAddress(account.id, id)) {
    return NextResponse.json({ error: 'No such address' }, { status: 404 });
  }

  return NextResponse.json({ removed: true });
}
