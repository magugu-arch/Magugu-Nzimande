import { LogOut } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Logo } from '../../components/ui/Logo';
import { adminApi, studioToken, type Overview } from '../../lib/adminApi';
import { RequestError } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { Diary } from './Diary';
import { Enquiries } from './Enquiries';
import { Hours } from './Hours';
import { ServicesAdmin } from './ServicesAdmin';
import { inputCls, Notice, SmallButton, Stat } from './ui';

const TABS = [
  ['diary', 'Diary'],
  ['hours', 'Opening hours'],
  ['services', 'Services & prices'],
  ['enquiries', 'Enquiries'],
] as const;
type Tab = (typeof TABS)[number][0];

/**
 * The studio dashboard. The studio signs in with the admin token set on the
 * server (ADMIN_TOKEN); every call is checked there, so this page shows
 * nothing without it. Not linked from the public site and not indexed.
 */
export default function Studio() {
  useTitle('Studio');
  const [token, setToken] = useState<string | null>(() => studioToken.get());

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  if (!token) return <SignIn onSignedIn={(t) => (studioToken.set(t), setToken(t))} />;
  return (
    <Dashboard
      onSignOut={() => {
        studioToken.set(null);
        setToken(null);
      }}
    />
  );
}

function SignIn({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const demo = import.meta.env.VITE_DEMO === 'true';
  const [value, setValue] = useState(demo ? 'demo' : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.checkToken(value.trim());
      onSignedIn(value.trim());
    } catch (err) {
      setError(err instanceof RequestError && err.status === 401 ? 'That studio key is not right. Check it and try again.' : err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-gutter flex min-h-dvh items-center justify-center bg-black py-16 text-white">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm space-y-6" noValidate>
        <Logo className="h-8" />
        <div>
          <h1 className="editorial-title text-5xl">Studio</h1>
          <p className="mt-3 font-sans text-sm opacity-70">Bookings, opening hours, prices and enquiries for Grateful.</p>
        </div>
        <label className="block font-sans text-sm">
          <span className="ui-label opacity-70">Studio key</span>
          <input id="studio-key" type="password" autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        {demo && <p className="font-sans text-xs opacity-60">Preview: any key works, and the diary is filled with sample bookings.</p>}
        {error && <Notice kind="error">{error}</Notice>}
        <SmallButton type="submit" variant="solid" busy={busy} disabled={!value.trim()}>
          Sign in
        </SmallButton>
        <p className="font-sans text-xs opacity-50">
          <Link to="/" className="underline">
            Back to the website
          </Link>
        </p>
      </form>
    </main>
  );
}

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>('diary');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [expired, setExpired] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let live = true;
    adminApi.overview().then(
      (o) => live && setOverview(o),
      (e: unknown) => live && e instanceof RequestError && e.status === 401 && setExpired(true),
    );
    return () => {
      live = false;
    };
  }, [bump]);

  const changed = useCallback(() => setBump((b) => b + 1), []);

  if (expired) {
    return (
      <main className="page-gutter flex min-h-dvh items-center justify-center bg-black text-white">
        <div className="max-w-sm space-y-4">
          <Notice kind="error">The studio key has changed or is no longer valid. Please sign in again.</Notice>
          <SmallButton variant="solid" onClick={onSignOut}>
            Sign in again
          </SmallButton>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-black text-white">
      <header className="page-gutter sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line bg-black">
        <div className="flex items-center gap-4">
          <Link to="/" aria-label="Grateful website">
            <Logo className="h-6" />
          </Link>
          <span className="ui-label hidden border-l border-line pl-4 sm:inline">Studio</span>
        </div>
        <SmallButton variant="text" onClick={onSignOut}>
          <LogOut aria-hidden className="size-4" /> Sign out
        </SmallButton>
      </header>

      <main className="page-gutter space-y-6 py-6">
        <section aria-label="At a glance" className="grid grid-cols-2 gap-px border border-line bg-white/15 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Today" value={overview?.todayCount ?? '–'} hint="confirmed" />
          <Stat label="Next 7 days" value={overview?.weekCount ?? '–'} hint="confirmed" />
          <Stat label="Awaiting payment" value={overview?.awaitingPayment ?? '–'} hint="held slots" />
          <Stat label="Needs attention" value={overview?.needsAttention ?? '–'} hint="paid, slot taken" />
          <Stat label="New enquiries" value={overview?.newMessages ?? '–'} />
          <Stat label="Subscribers" value={overview?.subscribers ?? '–'} hint="newsletter" />
        </section>

        <nav aria-label="Studio sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => setTab(key)}
              className={`min-h-11 shrink-0 border-b-2 px-3 font-sans text-sm whitespace-nowrap ${tab === key ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              {label}
              {key === 'enquiries' && overview?.newMessages ? <span className="ml-1.5 bg-white px-1.5 text-xs text-black tabular-nums">{overview.newMessages}</span> : null}
            </button>
          ))}
        </nav>

        {tab === 'diary' && <Diary onChange={changed} />}
        {tab === 'hours' && <Hours />}
        {tab === 'services' && <ServicesAdmin />}
        {tab === 'enquiries' && <Enquiries onChange={changed} />}
      </main>
    </div>
  );
}
