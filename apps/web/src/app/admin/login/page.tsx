import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignIn } from '@/components/admin/SignIn';
import { SESSION_COOKIE, isConsoleConfigured, isValidToken } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in — operations console',
  robots: { index: false, follow: false },
};

export default async function ConsoleLoginPage() {
  if (isValidToken((await cookies()).get(SESSION_COOKIE)?.value ?? null)) {
    redirect('/admin');
  }

  const configured = isConsoleConfigured();

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
      <h1 className="display text-[clamp(2.1rem,5vw,3.2rem)]">Operations</h1>

      {configured ? (
        <>
          <p className="mt-4 max-w-[60ch] text-sm leading-relaxed">
            This console changes what customers can order. Sign in with the passphrase your
            manager holds.
          </p>
          <SignIn />
        </>
      ) : (
        /* Fails closed, and says why: a locked console with an explanation is
           recoverable, an open one is not. */
        <p className="mt-4 max-w-[68ch] rounded-md border border-gold bg-white p-4 text-sm leading-relaxed">
          <span className="font-extrabold">This console is not configured.</span> No passphrase
          has been set for this deployment, so nobody can sign in. Set{' '}
          <code className="font-mono text-[0.85em]">BBQ_ADMIN_PASSWORD</code> in the server
          environment and restart.
        </p>
      )}
    </div>
  );
}
