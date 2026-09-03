import { RegisterRequestSchema } from '@bbq/types';
import { NextResponse } from 'next/server';
import { areAccountsConfigured, signInCookie } from '@/lib/accounts/session';
import { register } from '@/lib/accounts/store';

/**
 * POST /api/account — registers a customer.
 *
 * Answers with the account and a session cookie, so signing up does not then
 * make somebody sign in. It never answers with anything derived from the
 * password: `register` returns a public view, and the stored hash has no path
 * out of its module.
 */
export async function POST(request: Request) {
  if (!areAccountsConfigured()) {
    return NextResponse.json(
      {
        error: 'Accounts are not configured on this deployment',
        detail: 'Set BBQ_SESSION_SECRET to at least 16 characters to enable customer accounts.',
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body' }, { status: 400 });
  }

  const parsed = RegisterRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Check the details',
        // Field-level messages, because "check the details" on its own is a
        // form the customer cannot fix. The password's own message is a length
        // rule and gives nothing away.
        fields: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const result = register(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const cookie = signInCookie(result.account.id);
  if (!cookie) {
    return NextResponse.json({ error: 'Accounts are not configured' }, { status: 503 });
  }

  return NextResponse.json(
    { account: result.account },
    { status: 201, headers: { 'set-cookie': cookie } },
  );
}
