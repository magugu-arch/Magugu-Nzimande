'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { OPERATOR_ROLE_LABELS } from '@/lib/operators';
import {
  currentOperator,
  isLive,
  liveSession,
  refreshLive,
  resetDemo,
  runScheduler,
  signOut,
  startSignIn,
  switchOperator,
  useAnnouncement,
  useConsole,
  useLiveStatus,
} from '@/lib/store';

const NAV: {
  group: string;
  items: { href: string; label: string; badge?: 'approvals' | 'moderation' }[];
}[] = [
  {
    group: 'Overview',
    items: [{ href: '/', label: 'Dashboard' }],
  },
  {
    group: 'Communicate',
    items: [
      { href: '/notifications/', label: 'Notifications' },
      { href: '/approvals/', label: 'Approvals', badge: 'approvals' },
      { href: '/audience/', label: 'Audiences' },
    ],
  },
  {
    group: 'Campus life',
    items: [
      { href: '/events/', label: 'Events' },
      { href: '/commerce/', label: 'Commerce' },
      { href: '/services/', label: 'Service directory' },
    ],
  },
  {
    group: 'Trust',
    items: [
      { href: '/content/', label: 'Help content & search' },
      { href: '/moderation/', label: 'Moderation', badge: 'moderation' },
      { href: '/roles/', label: 'Roles & permissions' },
      { href: '/audit/', label: 'Audit log' },
    ],
  },
  {
    group: 'Measure',
    items: [{ href: '/analytics/', label: 'Analytics' }],
  },
];

const noop = () => () => {};
/** False during the static render and hydration; true once in the browser. */
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

const normalise = (p: string) => (p.endsWith('/') ? p : `${p}/`);

function Nav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = normalise(usePathname() ?? '/');
  const data = useConsole();
  const op = currentOperator(data);
  const counts = {
    approvals:
      data.campaigns.filter((c) => c.status === 'pending-approval' && c.authorId !== op.id).length +
      data.events.filter((e) => e.status === 'pending-approval').length,
    moderation: data.moderation.filter((m) => m.status === 'open').length,
  };
  return (
    <>
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="nav-group" id={`nav-${g.group}`}>
            {g.group}
          </p>
          <ul className="nav-list" aria-labelledby={`nav-${g.group}`}>
            {g.items.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              const count = item.badge ? counts[item.badge] : 0;
              return (
                <li key={item.href}>
                  <Link
                    className="nav-link"
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    <span>{item.label}</span>
                    {count > 0 ? (
                      <span className="nav-count">
                        {count}
                        <span className="visually-hidden"> waiting</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

function OperatorPicker() {
  const data = useConsole();
  const op = currentOperator(data);
  return (
    <div className="operator-picker">
      <label htmlFor="operator">Working as</label>
      <select id="operator" value={op.id} onChange={(e) => switchOperator(e.target.value)}>
        {data.operators.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} — {OPERATOR_ROLE_LABELS[o.role]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Live mode: who is signed in comes from NMU SSO, not a picker. */
function SignedInAs() {
  const session = liveSession();
  if (!session) return null;
  return (
    <p className="operator-picker" data-testid="signed-in-as">
      <span>Signed in as</span>
      <strong>
        {session.operator.name}, {session.operator.title}
      </strong>
    </p>
  );
}

function SignInPanel() {
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="stack sign-in" aria-labelledby="sign-in-h" data-testid="console-sign-in">
      <h1 id="sign-in-h">Sign in to the operator console</h1>
      <p className="muted">
        Use your NMU staff account. What you can do here depends on the role NMU has given you, and
        the server checks it on every action.
      </p>
      {problem ? (
        <p className="notice tone-danger" role="alert">
          {problem}
        </p>
      ) : null}
      <div>
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setProblem(null);
            try {
              await startSignIn();
            } catch (e) {
              setBusy(false);
              setProblem(e instanceof Error ? e.message : 'Sign-in didn’t start. Try again.');
            }
          }}
          data-testid="console-sso"
        >
          {busy ? 'Opening NMU SSO…' : 'Sign in with NMU SSO'}
        </button>
      </div>
    </section>
  );
}

function Announcer() {
  const { id, text } = useAnnouncement();
  const [visible, setVisible] = useState<number | null>(null);
  const shown = visible === id && text;
  useEffect(() => {
    if (!text) return;
    const show = setTimeout(() => setVisible(id), 0);
    const hide = setTimeout(() => setVisible(null), 5000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [id, text]);
  return (
    <>
      <div role="status" aria-live="polite" className="visually-hidden">
        {text}
      </div>
      {shown ? (
        <div className="toast" aria-hidden="true" data-testid="toast">
          {text}
        </div>
      ) : null}
    </>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const liveStatus = useLiveStatus();
  // The sign-in callback renders before there is a session.
  const callback = normalise(pathname ?? '/') === '/auth/callback/';
  const ready = hydrated && (!isLive || liveStatus === 'ready');

  // Live mode: load what the server holds, and keep it fresh so operators see
  // each other's work (an approval, a new submission) within seconds.
  useEffect(() => {
    if (!hydrated || !isLive || callback) return;
    void refreshLive();
    const t = setInterval(() => void refreshLive(), 5_000);
    return () => clearInterval(t);
  }, [hydrated, callback]);

  // Scheduled notices go out when their time comes, while the console is open
  // (in live mode the server sends them).
  useEffect(() => {
    if (!hydrated || isLive) return;
    runScheduler();
    const t = setInterval(runScheduler, 15_000);
    return () => clearInterval(t);
  }, [hydrated]);

  // Move focus to the page on navigation so screen readers start at the top.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar-head">
            <Link href="/" className="brand" aria-label="NMU ONE Console — dashboard">
              <span className="brand-mark" aria-hidden="true">
                NMU
                <span />
                ONE
              </span>
              <span className="brand-name">
                NMU ONE
                <span className="brand-sub">Operator console</span>
              </span>
            </Link>
            <button
              type="button"
              className="btn small menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="console-nav"
              onClick={() => setMenuOpen((o) => !o)}
            >
              Menu
            </button>
          </div>
          <nav id="console-nav" aria-label="Console" className="nav-sections" data-open={menuOpen}>
            {ready ? <Nav onNavigate={() => setMenuOpen(false)} /> : null}
          </nav>
          <p className="sidebar-foot">
            {isLive
              ? 'Every action is checked by the server against your role and written to the audit log.'
              : 'Demo data only. Every action is permission-checked and written to the audit log.'}
          </p>
        </aside>
        <div className="main-col">
          <div className="topbar">
            <div className="topbar-left">
              {ready ? isLive ? <SignedInAs /> : <OperatorPicker /> : null}
            </div>
            <div className="topbar-right">
              <span className={`badge ${isLive ? 'tone-info' : 'tone-warning'}`}>
                {isLive ? 'Live' : 'Demo data'}
              </span>
              {ready && isLive ? (
                <button type="button" className="btn small" onClick={() => void signOut()}>
                  Sign out
                </button>
              ) : null}
              {hydrated && !isLive ? (
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    if (window.confirm('Reset all demo data in this browser?')) resetDemo();
                  }}
                >
                  Reset demo
                </button>
              ) : null}
            </div>
          </div>
          <main id="main" ref={mainRef} tabIndex={-1}>
            {ready || (hydrated && callback) ? (
              children
            ) : hydrated && liveStatus === 'signed-out' ? (
              <SignInPanel />
            ) : hydrated && liveStatus === 'unavailable' ? (
              <section className="stack" role="alert">
                <h1>The console service isn’t answering</h1>
                <p className="muted">Nothing has changed. Try again in a moment.</p>
                <div>
                  <button type="button" className="btn" onClick={() => void refreshLive()}>
                    Try again
                  </button>
                </div>
              </section>
            ) : (
              <div className="loading" aria-busy="true" aria-label="Loading the console">
                <div className="skeleton" style={{ width: '30%', height: 28 }} />
                <div className="skeleton" style={{ width: '60%' }} />
                <div className="skeleton" style={{ width: '45%' }} />
              </div>
            )}
          </main>
        </div>
      </div>
      {hydrated ? <Announcer /> : null}
    </>
  );
}
