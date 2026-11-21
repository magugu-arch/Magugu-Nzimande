import type { Metadata } from 'next';
import Image from 'next/image';
import { signInAction } from '@/actions/session';
import { getStore } from '@/lib/instance';
import { mediaFor } from '@/lib/media';
import { isConsoleRole, roleLabels, sectionsFor } from '@/lib/rbac';
import { getActor } from '@/lib/session';
import { DemoTag } from '@/components/ui';

export const metadata: Metadata = { title: 'Demo sign-in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ refused?: string }>;
}) {
  const [{ refused }, actor] = await Promise.all([searchParams, getActor()]);
  const accounts = getStore()
    .listStaff()
    .filter((user) => !user.system && isConsoleRole(user.role));
  const crest = mediaFor('crest');

  return (
    <main id="main" tabIndex={-1} className="sign-in">
      <div className="sign-in__panel">
        {crest ? (
          <Image
            className="sign-in__crest"
            src={crest.src}
            alt={crest.alt}
            width={crest.width}
            height={crest.height}
            priority
          />
        ) : null}
        <div>
          <p className="eyebrow">Scarlets One · Operations console</p>
          <h1>Choose a demo account</h1>
          <p className="lede">
            This is a demo sign-in, not real authentication. Pick a staff account to see the console
            as that role. Each role sees only its own sections, and the server checks the role again
            on every action.
          </p>
        </div>

        {refused ? (
          <p className="form-problem" role="alert">
            {refused === 'forbidden'
              ? 'Refused. That account cannot sign in to the operations console.'
              : 'That demo account does not exist. Choose one from the list.'}
          </p>
        ) : null}

        <ul className="accounts">
          {accounts.map((user) => (
            <li key={user.id} className="account">
              <div>
                <p className="account__name">
                  {user.name} <DemoTag />
                </p>
                <p className="meta">
                  {roleLabels[user.role]} · opens{' '}
                  {sectionsFor(user.role)
                    .map((section) => section.label)
                    .join(', ')}
                </p>
              </div>
              <form action={signInAction}>
                <input type="hidden" name="accountId" value={user.id} />
                <button
                  type="submit"
                  className={actor?.id === user.id ? 'btn btn--secondary' : 'btn btn--primary'}
                  aria-label={`Sign in as ${user.name}, ${roleLabels[user.role]}`}
                >
                  {actor?.id === user.id ? 'Continue' : 'Sign in'}
                </button>
              </form>
            </li>
          ))}
        </ul>

        <p className="note">
          <strong>Supporter and service roles cannot sign in here.</strong> A supporter has no
          console access, and the service role belongs to systems such as the scheduler, not to a
          person.
        </p>
      </div>
    </main>
  );
}
