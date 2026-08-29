'use client';

import { completedLabel, statesForMode, type Order, type OrderState } from '@bbq/types';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { FoodImage } from '@/components/food/FoodImage';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DemoFlag } from '@/components/ui/DemoValue';
import { Price } from '@/components/ui/Price';
import { describeOptions } from '@/lib/cart';
import { advanceOrder } from '@/lib/client-api';

const MESSAGES: Record<OrderState, string> = {
  received: 'We have your order and the kitchen has it on the rail.',
  preparing: 'Your chicken is in the fryer. First fry, then the second.',
  ready: 'Sauced, packed and checked.',
  out_for_delivery: 'Your driver has collected the order.',
  completed: 'Enjoy. Your points have posted.',
};

const POLL_MS = 20_000;

export function OrderJourney() {
  const params = useSearchParams();
  const orderId = params.get('order');
  const { orders, recordOrder, addLine, announce } = useOrdering();

  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [stepping, setStepping] = useState(false);

  const tracked = useMemo(
    () => order ?? orders.find((candidate) => candidate.id === orderId) ?? orders[0] ?? null,
    [order, orders, orderId],
  );

  const trackedId = tracked?.id ?? null;
  const trackedStatus = tracked?.status ?? null;

  useEffect(() => {
    if (!trackedId) return;
    if (trackedStatus === 'completed' || trackedStatus === 'cancelled') return;

    let cancelled = false;

    async function poll() {
      try {
        // Advancing on the tick stands in for a kitchen display system, so the
        // five states can be watched end to end without one.
        const result = await advanceOrder(trackedId!);
        if (cancelled) return;
        setOrder(result.order);
        recordOrder(result.order);
        announce(`Order status: ${result.statusLabel}.`);
      } catch {
        // The in-process order store does not survive a server restart, which
        // in development is routine. The order held in this browser stays on
        // screen rather than the screen emptying itself.
        if (!cancelled) setNotFound(true);
      }
    }

    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [trackedId, trackedStatus, recordOrder, announce]);

  if (!tracked) {
    return (
      <div className="rounded-md border border-line bg-white p-10 text-center">
        <p className="display text-2xl text-black-60">No order to follow</p>
        <p className="mt-2 text-sm text-muted">
          Place an order and its progress appears here, step by step.
        </p>
        <div className="mt-5">
          <ButtonLink href="/menu">Browse the menu</ButtonLink>
        </div>
      </div>
    );
  }

  const states = statesForMode(tracked.mode);
  const currentIndex =
    tracked.status === 'cancelled' ? -1 : states.indexOf(tracked.status as OrderState);

  async function stepForward() {
    if (!trackedId) return;
    setStepping(true);
    try {
      const result = await advanceOrder(trackedId);
      setOrder(result.order);
      recordOrder(result.order);
      announce(`Order status: ${result.statusLabel}.`);
    } catch {
      setNotFound(true);
    } finally {
      setStepping(false);
    }
  }

  function reorder() {
    for (const line of tracked!.lines) {
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
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <div className="rounded-md border border-line bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                Order number
              </p>
              <p className="tabular display mt-1 text-3xl">{tracked.orderNumber}</p>
            </div>
            <span className="rounded-full bg-red px-3.5 py-1.5 text-xs font-bold text-white">
              {tracked.status === 'cancelled'
                ? 'Cancelled'
                : tracked.status === 'completed'
                  ? completedLabel(tracked.mode)
                  : tracked.mode}
            </span>
          </div>

          {notFound && (
            <p className="mt-4 rounded-sm bg-paper px-4 py-3 text-xs text-muted">
              Live status is unavailable right now. The order below is the copy held in this
              browser.
            </p>
          )}

          <ol className="mt-7">
            {states.map((state, index) => {
              const done = index < currentIndex;
              const active = index === currentIndex;
              const label =
                state === 'completed'
                  ? completedLabel(tracked.mode)
                  : state === 'received'
                    ? 'Order received'
                    : state === 'preparing'
                      ? 'Preparing'
                      : state === 'ready'
                        ? 'Ready'
                        : 'On the way';

              return (
                <li key={state} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      aria-hidden="true"
                      className={[
                        'grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-extrabold',
                        done || active
                          ? 'border-red bg-red text-white'
                          : 'border-line bg-white text-black-40',
                      ].join(' ')}
                    >
                      {done ? '✓' : index + 1}
                    </span>
                    {index < states.length - 1 && (
                      <span
                        aria-hidden="true"
                        className={[
                          'w-0.5 flex-1',
                          index < currentIndex ? 'bg-red' : 'bg-line',
                        ].join(' ')}
                      />
                    )}
                  </div>
                  <div className={index < states.length - 1 ? 'pb-7' : ''}>
                    <p
                      className={[
                        'text-sm font-extrabold',
                        active ? 'text-red' : done ? 'text-black' : 'text-black-40',
                      ].join(' ')}
                    >
                      {label}
                      {active && <span className="sr-only"> — current step</span>}
                    </p>
                    {(active || done) && (
                      <p className="mt-1 max-w-[46ch] text-xs leading-relaxed text-muted">
                        {MESSAGES[state]}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {tracked.status !== 'completed' && tracked.status !== 'cancelled' && (
            <p className="mt-2 text-xs text-muted">
              Updating every {POLL_MS / 1000} seconds. Estimated {tracked.etaMinutes} minutes from
              when the order was placed.
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={reorder}>Order this again</Button>
          <ButtonLink href="/menu" variant="ghost">
            Add something else
          </ButtonLink>
          {tracked.status !== 'completed' && tracked.status !== 'cancelled' && (
            // Kept from the reference build so an order can be walked through
            // its states on demand rather than at the timer's pace.
            <Button variant="ghost" onClick={stepForward} disabled={stepping}>
              {stepping ? 'Moving…' : 'Move to next step'}
              <DemoFlag label="Demo" />
            </Button>
          )}
        </div>
      </div>

      <aside className="rounded-md border border-line bg-white p-5 lg:sticky lg:top-24 lg:self-start">
        <h2 className="display text-xl">What you ordered</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {tracked.lines.map((line) => (
            <li key={line.key} className="flex gap-3 py-3">
              <div className="size-12 shrink-0 overflow-hidden rounded-xs bg-paper">
                <FoodImage
                  imageKey={line.imageKey}
                  alt=""
                  sizes="48px"
                  className="size-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">
                  <span className="tabular">{line.quantity}&times;</span> {line.name}
                </p>
                {line.options.length > 0 && (
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">
                    {describeOptions(line.options)}
                  </p>
                )}
              </div>
              <Price cents={line.unitCents * line.quantity} className="text-xs font-bold" />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-between text-base font-extrabold">
          <span>Total</span>
          <Price cents={tracked.totals.totalCents} />
        </div>

        {tracked.kitchenNote && (
          <div className="mt-4 rounded-sm bg-paper p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
              Note for the kitchen
            </p>
            <p className="mt-1 text-xs">{tracked.kitchenNote}</p>
          </div>
        )}

        <p className="mt-4 text-xs text-muted">
          Earning{' '}
          <span className="tabular font-bold text-red">
            {tracked.pointsEarned.toLocaleString('en-ZA')}
          </span>{' '}
          points on this order.
        </p>
      </aside>
    </div>
  );
}
