import Image from 'next/image';
import type { ReactNode } from 'react';
import { signInAction, signOutAction } from '@/actions/session';
import { NoticeProvider } from '@/components/notice';
import { SidebarNav } from '@/components/sidebar-nav';
import { formatDateTime } from '@/lib/format';
import { getStore } from '@/lib/instance';
import { mediaFor } from '@/lib/media';
import { isConsoleRole, mayAct, roleLabels, sectionsFor } from '@/lib/rbac';
import { requireActor } from '@/lib/session';

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  const store = getStore();
  const counts = store.counts();
  const accounts = store.listStaff().filter((user) => !user.system && isConsoleRole(user.role));
  const crest = mediaFor('crest');

  // The navigation is built here, on the server, from the role. A hidden link
  // is a convenience; the pages and the Server Actions check again.
  const items = sectionsFor(actor.role).map((section) => ({
    id: section.id,
    href: section.href,
    label: section.label,
    count:
      section.id === 'moderation' && mayAct(actor.role, 'moderation.review')
        ? counts.moderation.pending
        : undefined,
  }));

  return (
    <div className="shell">
      <div className="sidebar">
        <div className="sidebar__inner">
          <div className="brand">
            {crest ? (
              <span className="brand__plate">
                <Image src={crest.src} alt={crest.alt} width={crest.width} height={crest.height} />
              </span>
            ) : null}
            <div>
              <p className="brand__name">Scarlets One</p>
              <p className="eyebrow">Operations · Concept</p>
            </div>
          </div>

          <SidebarNav items={items} />

          <section className="session" aria-label="Demo sign-in">
            <div>
              <p className="eyebrow">Signed in · Demo</p>
              <p className="session__who">{actor.name}</p>
              <p className="session__role">Role: {roleLabels[actor.role]}</p>
            </div>
            <form action={signInAction} className="stack stack--tight">
              <div className="field">
                <label htmlFor="switch-account">Switch role</label>
                <select id="switch-account" name="accountId" defaultValue={actor.id}>
                  {accounts.map((user) => (
                    <option key={user.id} value={user.id}>
                      {roleLabels[user.role]}: {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn--secondary">
                Switch
              </button>
            </form>
            <form action={signOutAction}>
              <button type="submit" className="btn btn--quiet">
                Sign out
              </button>
            </form>
          </section>

          <p className="store-note">
            <strong>Demo store.</strong> Held in memory on the server: it resets when the server
            restarts. Demo clock: {formatDateTime(store.now().toISOString())}.
          </p>
        </div>
      </div>

      <main id="main" tabIndex={-1} className="main">
        <NoticeProvider>{children}</NoticeProvider>
      </main>
    </div>
  );
}
