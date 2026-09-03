'use client';

import type { Account, Order, SavedAddress } from '@bbq/types';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Price } from '@/components/ui/Price';
import {
  AccountError,
  addAddress,
  downloadMyData,
  eraseMe,
  myAddresses,
  myOrders,
  register,
  removeAddress,
  signIn,
  signOut,
  whoAmI,
} from '@/lib/account-api';

/**
 * The customer's account.
 *
 * The endpoints behind this were built and tested before anything called them,
 * which made a whole account system unreachable — order history that follows a
 * person to a new phone, an address book, and the two POPIA requests. This is
 * the interface to them.
 *
 * Deliberately thin. Everything that can be got wrong lives in
 * `lib/account-api.ts`, where it is tested without a DOM; this decides what to
 * show and when.
 */

type Mode = 'sign-in' | 'register';

export function CustomerAccount({
  initialAccount,
  initialOrders,
  initialAddresses,
}: {
  initialAccount: Account | null;
  initialOrders: readonly Order[];
  initialAddresses: readonly SavedAddress[];
}) {
  /**
   * Seeded from the server render, so the page arrives in its final state.
   *
   * This used to fetch who you were in an effect, which showed a loading line
   * to everybody — including the people who are not signed in and have nothing
   * to wait for — and had the server render a page it already knew was wrong.
   */
  const [account, setAccount] = useState<Account | null>(initialAccount);
  const [orders, setOrders] = useState<readonly Order[]>(initialOrders);
  const [addresses, setAddresses] = useState<readonly SavedAddress[]>(initialAddresses);
  const [signOutFailed, setSignOutFailed] = useState(false);

  /** Called after signing in or registering, when the server state has changed. */
  const reload = useCallback(async () => {
    try {
      const who = await whoAmI();
      setAccount(who);
      if (!who) return;

      const [theirOrders, theirAddresses] = await Promise.all([myOrders(), myAddresses()]);
      setOrders(theirOrders);
      setAddresses(theirAddresses);
    } catch {
      // Accounts are switched off on this deployment, or the network failed.
      // The ordering journey does not depend on being signed in, so the page
      // stays usable either way.
      setAccount(null);
    }
  }, []);

  if (!account) return <SignedOut onSignedIn={reload} />;

  return (
    <div className="grid gap-8">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="display text-2xl">{account.name}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              // Only the server can clear the session cookie, so the screen
              // stays signed in when the server did not confirm. Clearing it
              // anyway would tell someone on a shared phone they were signed
              // out while their session was still open.
              if (!(await signOut())) {
                setSignOutFailed(true);
                return;
              }
              setSignOutFailed(false);
              setAccount(null);
              setOrders([]);
              setAddresses([]);
            }}
          >
            Sign out
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted">
          {account.email} · {account.points} points
        </p>
        {signOutFailed && (
          <p role="alert" className="mt-2 text-sm font-semibold text-red">
            You are still signed in — we could not reach the server. Check your connection and try
            again.
          </p>
        )}
      </section>

      <section>
        <h3 className="display text-xl">Your orders</h3>
        <p className="mt-1 text-sm text-muted">
          These follow your account, not this device.
        </p>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-sm border border-line bg-white p-3 text-sm"
              >
                <span className="font-bold">{order.orderNumber}</span>
                <span className="text-muted">{order.mode}</span>
                <Price cents={order.totals.totalCents} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddressBook
        addresses={addresses}
        onChanged={async () => setAddresses(await myAddresses())}
      />

      <PrivacySection
        onErased={() => {
          setAccount(null);
          setOrders([]);
          setAddresses([]);
        }}
      />
    </div>
  );
}

function SignedOut({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      if (mode === 'register') await register({ name, email, mobile, password });
      else await signIn(email, password);
      await onSignedIn();
    } catch (caught) {
      if (caught instanceof AccountError) {
        setError(caught.message);
        // Beside the input that caused it rather than at the top of the page.
        setFieldErrors(
          Object.fromEntries(caught.fields.map((field) => [field.field, field.message])),
        );
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md">
      <h2 className="display text-2xl">
        {mode === 'register' ? 'Create an account' : 'Sign in'}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Ordering works without one. An account keeps your addresses and your order history.
      </p>

      <div className="mt-4 grid gap-4">
        {mode === 'register' && (
          <>
            <Field
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={fieldErrors.name}
              autoComplete="name"
            />
            <Field
              label="Mobile"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              error={fieldErrors.mobile}
              autoComplete="tel"
              inputMode="tel"
            />
          </>
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          autoComplete="email"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          hint={mode === 'register' ? 'At least 10 characters.' : undefined}
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-red">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {mode === 'register' ? 'Create account' : 'Sign in'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setMode(mode === 'register' ? 'sign-in' : 'register');
            setError(null);
            setFieldErrors({});
          }}
        >
          {mode === 'register' ? 'I already have one' : 'Create one instead'}
        </Button>
      </div>
    </form>
  );
}

function AddressBook({
  addresses,
  onChanged,
}: {
  addresses: readonly SavedAddress[];
  onChanged: () => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [line, setLine] = useState('');
  const [suburb, setSuburb] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <section>
      <h3 className="display text-xl">Saved addresses</h3>

      {addresses.length === 0 ? (
        <p className="mt-2 text-sm text-muted">None saved.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-sm border border-line bg-white p-3 text-sm"
            >
              <span>
                <span className="font-bold">{address.label}</span>{' '}
                <span className="text-muted">
                  — {address.address}, {address.suburb}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await removeAddress(address.id);
                  await onChanged();
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Label" value={label} onChange={(event) => setLabel(event.target.value)} />
        <Field
          label="Street address"
          value={line}
          onChange={(event) => setLine(event.target.value)}
          autoComplete="street-address"
        />
        <Field
          label="Suburb"
          value={suburb}
          onChange={(event) => setSuburb(event.target.value)}
          autoComplete="address-level2"
        />
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-red">
          {error}
        </p>
      )}

      <Button
        className="mt-3"
        size="sm"
        onClick={async () => {
          setError(null);
          try {
            await addAddress({ label, address: line, suburb, note: '' });
            setLabel('');
            setLine('');
            setSuburb('');
            await onChanged();
          } catch {
            setError('Check the address and try again.');
          }
        }}
      >
        Save address
      </Button>
    </section>
  );
}

/**
 * The two data-subject requests, as POPIA gives them.
 *
 * Both are on the page rather than behind an email to support, because a right
 * that needs a request to exercise is a right most people do not exercise.
 */
function PrivacySection({ onErased }: { onErased: () => void }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <section>
      <h3 className="display text-xl">Your data</h3>

      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          variant="black"
          size="sm"
          onClick={async () => {
            const blob = await downloadMyData();
            // The download is started here rather than by linking the endpoint,
            // so a failure is a caught error instead of a browser error page.
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'bbq-chicken-my-data.json';
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download everything we hold
        </Button>

        {confirming ? (
          <>
            <Button
              size="sm"
              onClick={async () => {
                await eraseMe();
                onErased();
              }}
            >
              Yes, erase my account
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Erase my account
          </Button>
        )}
      </div>

      <p className="mt-2 max-w-[60ch] text-xs text-muted">
        Erasing removes your account and your saved addresses. Past orders stay as sales records
        with your details removed, because a business is required to keep them.
      </p>
    </section>
  );
}
