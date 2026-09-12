'use client';

import { completedLabel } from '@bbq/types';
import Link from 'next/link';
import { useState } from 'react';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Price } from '@/components/ui/Price';
import { describeReprice } from '@/lib/cart';
import { repriceBasket } from '@/lib/client-api';
import { pointsFor } from '@/lib/pricing';

export function AccountPanel() {
  const { orders, hydrated, addLine, store, mode } = useOrdering();
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [note, setNote] = useState<{ orderId: string; text: string } | null>(null);

  const earned = orders
    .filter((order) => order.status === 'completed')
    .reduce((total, order) => total + pointsFor(order.totals.totalCents), 0);

  /**
   * The same food, at what it costs today.
   *
   * The journey screen's button had the same defect and the same fix: this
   * copied each line out of the past order — its name, its options and the
   * price it cost then — and asked nobody whether any of it still held. The
   * order route prices everything again and refuses a basket whose numbers
   * disagree, so pressing this after a price moved or an item sold out bought
   * the customer four screens of checkout and then a refusal naming slugs.
   *
   * The note is keyed to the order it is about, because this list has one of
   * these buttons per order and a message floating above all of them would be
   * about whichever one was pressed last.
   */
  async function reorder(orderId: string) {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) return;

    setBusyOrderId(orderId);
    setNote(null);

    let basket;
    try {
      basket = await repriceBasket([...order.lines]);
    } catch {
      setNote({ orderId, text: 'We could not check that order against today\u2019s menu. Try again.' });
      setBusyOrderId(null);
      return;
    }

    for (const line of basket.lines) {
      addLine({
        slug: line.slug,
        name: line.name,
        imageKey: line.imageKey,
        quantity: line.quantity,
        unitCents: line.unitCents,
        options: line.options,
      });
    }

    const changes = describeReprice(basket);
    const text =
      basket.lines.length === 0
        ? `Nothing from that order is available today. ${changes ?? ''}`.trim()
        : changes;

    setNote(text ? { orderId, text } : null);
    setBusyOrderId(null);
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => reorder(order.id)}
                      disabled={busyOrderId === order.id}
                    >
                      {busyOrderId === order.id ? 'Checking\u2026' : 'Order again'}
                    </Button>
                    <Link
                      href={`/journey?order=${order.id}`}
                      className="inline-flex h-9.5 items-center rounded-full bg-black px-4 text-[13px] font-bold text-white transition-colors hover:bg-black-80"
                    >
                      Track
                    </Link>
                  </div>
                </div>

                {/*
                  What moved since that order, under the order it is about.
                  Announced as well as shown: the basket fills without the page
                  changing, so a customer who cannot see the drawer has no other
                  way to learn that a line was left out.
                */}
                {note?.orderId === order.id && (
                  <p className="mt-3 rounded-xs bg-paper px-4 py-3 text-xs text-muted" role="status">
                    {note.text}
                  </p>
                )}
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
