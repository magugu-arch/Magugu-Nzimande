'use client';

import { completedLabel } from '@bbq/types';
import Link from 'next/link';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Price } from '@/components/ui/Price';
import { pointsFor } from '@/lib/pricing';

export function AccountPanel() {
  const { orders, hydrated, addLine, store, mode } = useOrdering();

  const earned = orders
    .filter((order) => order.status === 'completed')
    .reduce((total, order) => total + pointsFor(order.totals.totalCents), 0);

  function reorder(orderId: string) {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) return;
    for (const line of order.lines) {
      addLine({
        slug: line.slug,
        name: line.name,
        imageKey: line.imageKey,
        quantity: line.quantity,
        unitCents: line.unitCents,
        options: line.options,
      });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
      <section>
        <h2 className="display text-2xl">Order history</h2>

        {!hydrated ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : orders.length === 0 ? (
          <div className="mt-4 rounded-md border border-line bg-white p-10 text-center">
            <p className="display text-2xl text-black-60">No orders yet</p>
            <p className="mt-2 text-sm text-muted">
              Orders you place appear here, ready to send again in one tap.
            </p>
            <div className="mt-5">
              <ButtonLink href="/menu">Browse the menu</ButtonLink>
            </div>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {orders.map((order) => (
              <li key={order.id} className="rounded-md border border-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="tabular text-sm font-extrabold">{order.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {new Date(order.placedAt).toLocaleString('en-ZA', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}{' '}
                      · {order.mode}
                    </p>
                  </div>
                  <span
                    className={[
                      'rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]',
                      order.status === 'completed'
                        ? 'bg-red-10 text-red'
                        : order.status === 'cancelled'
                          ? 'bg-black-10 text-black-80'
                          : 'bg-yellow text-black',
                    ].join(' ')}
                  >
                    {order.status === 'completed'
                      ? completedLabel(order.mode)
                      : order.status === 'cancelled'
                        ? 'Cancelled'
                        : 'In progress'}
                  </span>
                </div>

                <p className="mt-3 text-xs text-muted">
                  {order.lines
                    .map((line) => `${line.quantity}× ${line.name}`)
                    .join(', ')}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <Price cents={order.totals.totalCents} className="text-base font-extrabold" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => reorder(order.id)}>
                      Order again
                    </Button>
                    <Link
                      href={`/journey?order=${order.id}`}
                      className="inline-flex h-9.5 items-center rounded-full bg-black px-4 text-[13px] font-bold text-white transition-colors hover:bg-black-80"
                    >
                      Track
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="space-y-6">
        <div className="rounded-md bg-black p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-gold">Points</p>
          <p className="tabular display mt-2 text-5xl">
            {hydrated ? earned.toLocaleString('en-ZA') : '0'}
          </p>
          <Link href="/rewards" className="mt-3 inline-block text-sm text-white/70 underline">
            See what they buy
          </Link>
        </div>

        <div className="rounded-md border border-line bg-white p-5">
          <h2 className="display text-xl">Ordering from</h2>
          <p className="mt-2 text-sm font-bold">{store.name}</p>
          <p className="mt-0.5 text-xs text-muted">{store.address}</p>
          <p className="mt-2 text-xs text-muted">Currently set to {mode.toLowerCase()}.</p>
          <div className="mt-4">
            <ButtonLink href="/stores" variant="ghost" size="sm">
              Change store
            </ButtonLink>
          </div>
        </div>

        {/*
          The saved addresses that were here were two hardcoded strings — the
          same two for every visitor, which read as a feature and was a mock.
          The real address book belongs to an account and lives in
          CustomerAccount above.
        */}
      </aside>
    </div>
  );
}
