import { z } from '@bbq/types';
import { NextResponse } from 'next/server';
import { isConsoleConfigured, isSignedIn, signIn, signOutCookie } from '@/lib/admin-auth';
import { recordAudit } from '@/lib/catalogue-state';

/**
 * The console's sign-in and sign-out.
 *
 * The one route under /api/admin that an unauthenticated caller may reach —
 * everything else refuses first.
 */

const BodySchema = z.object({ passphrase: z.string().min(1) });

/** GET /api/admin/session — whether this caller is signed in. */
export function GET(request: Request) {
  return NextResponse.json({
    configured: isConsoleConfigured(),
    signedIn: isSignedIn(request),
  });
}

/** POST /api/admin/session — sign in. */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // Nothing from the request is echoed back: a passphrase submitted to the
    // wrong field should not come home in an error message.
    return NextResponse.json({ error: 'Enter the console passphrase.' }, { status: 400 });
  }

  const result = signIn(parsed.data.passphrase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Who is not knowable from a shared passphrase, and the log should not
  // imply that it is.
  recordAudit('operator', 'Signed in to the console');

  const response = NextResponse.json({ signedIn: true });
  response.headers.set('set-cookie', result.cookie);
  return response;
}

/** DELETE /api/admin/session — sign out. */
export function DELETE(request: Request) {
  if (isSignedIn(request)) recordAudit('operator', 'Signed out of the console');

  const response = NextResponse.json({ signedIn: false });
  response.headers.set('set-cookie', signOutCookie());
  return response;
}
