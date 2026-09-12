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
    /**
     * What is wrong, and not which variable is missing.
     *
     * This used to carry a `detail` naming the environment variable and its
     * length rule. Nobody who can act on that is reading an HTTP response —
     * the variable is in the README's table of what each one switches on and
     * in `.env.example`, which is where somebody deploying this is already
     * looking. What the reply did instead was tell any anonymous caller which
     * variable gates authentication on this deployment and that it is
     * currently not set.
     *
     * The health endpoint has the rule written above it: no secret, hostname
     * or connection string, only whether each thing is present. It reports
     * `accounts: false` and stops, and that is the right amount to say out
     * loud.
     */
    return NextResponse.json(
      { error: 'Accounts are not configured on this deployment' },
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
