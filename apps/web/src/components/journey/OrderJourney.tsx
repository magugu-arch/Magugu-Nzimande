'use client';

import {
  completedLabel,
  kitchenMayStart,
  statesForMode,
  type Order,
  type OrderPayment,
  type OrderState,
} from '@bbq/types';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FoodImage } from '@/components/food/FoodImage';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DemoFlag } from '@/components/ui/DemoValue';
import { Price } from '@/components/ui/Price';
import { describeOptions } from '@/lib/cart';
import { advanceOrder, fetchOrder, openPayment } from '@/lib/client-api';

const MESSAGES: Record<OrderState, string> = {
  received: 'We have your order and the kitchen has it on the rail.',
  preparing: 'Your chicken is in the fryer. First fry, then the second.',
  ready: 'Sauced, packed and checked.',
  out_for_delivery: 'Your driver has collected the order.',
  completed: 'Enjoy. Your points have posted.',
};

const POLL_MS = 20_000;

/**
 * Faster while a payment is settling.
 *
 * Somebody watching "confirming your payment" is watching it, and the gateway's
 * notification usually lands within seconds of them getting back here. Twenty
 * seconds of an unexplained wait is how a customer decides it has failed and
 * pays again somewhere else.
 */
const PAYMENT_POLL_MS = 3_000;

export function OrderJourney() {
  const params = useSearchParams();
  const orderId = params.get('order');
  const cancelled = params.get('payment') === 'cancelled';
  const { orders, recordOrder, addLine, announce } = useOrdering();

  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [stepping, setStepping] = useState(false);
  /**
   * Null until the server has been asked.
   *
   * Deliberately not defaulted to "no payment required": that default would
   * show a paid-for order as needing nothing during the moment before the first
   * response arrives, which is exactly the moment a customer coming back from
   * the gateway is looking at it.
   */
  const [payment, setPayment] = useState<OrderPayment | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const tracked = useMemo(
    () => order ?? orders.find((candidate) => candidate.id === orderId) ?? orders[0] ?? null,
    [order, orders, orderId],
  );

  const trackedId = tracked?.id ?? null;
  const trackedStatus = tracked?.status ?? null;

  /**
   * Whether the kitchen may be moved on. Null payment means "not asked yet",
   * which is treated as no — nothing should advance on an assumption about
   * money.
   */
  const mayAdvance = payment !== null && kitchenMayStart(payment);

  useEffect(() => {
    if (!trackedId) return;
    if (trackedStatus === 'completed' || trackedStatus === 'cancelled') return;

    let stopped = false;
    // Captured after the guard above, so the nested closure holds a string
    // rather than reaching back for a value the compiler cannot re-narrow.
    const id = trackedId;

    async function poll() {
      try {
        /**
         * Two different polls, and which one runs is the whole point.
         *
         * Advancing on the tick stands in for a kitchen display system so the
         * five states can be watched end to end without one. But an order whose
         * money has not arrived must not be cooked, so while the payment is
         * outstanding this only asks what the payment is doing. The server
         * refuses the advance in that state as well; this keeps the screen from
         * asking for something it knows will be refused.
         */
        const result = mayAdvance ? await advanceOrder(id) : await fetchOrder(id);
        if (stopped) return;
        setOrder(result.order);
        setPayment(result.payment);
        recordOrder(result.order);
        if (mayAdvance) announce(`Order status: ${result.statusLabel}.`);
      } catch {
        // The in-process order store does not survive a server restart, which
        // in development is routine. The order held in this browser stays on
        // screen rather than the screen emptying itself.
        if (!stopped) setNotFound(true);
      }
    }

    void poll();
    const timer = window.setInterval(poll, mayAdvance ? POLL_MS : PAYMENT_POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [trackedId, trackedStatus, mayAdvance, recordOrder, announce]);

  /** Opens a payment for an order that has one outstanding, and hands over. */
  const payNow = useCallback(async () => {
    if (!trackedId) return;
    setPaying(true);
    setPayError(null);
    try {
      const { redirectUrl } = await openPayment(trackedId);
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }
      // A gateway that took the money without a redirect. The next poll will
      // pick the settlement up.
      setPaying(false);
    } catch (error) {
      setPayError(
        error instanceof Error ? error.message : 'We could not start the payment. Try again.',
      );
      setPaying(false);
    }
  }, [trackedId]);

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
    if (!tracked) return;
    for (const line of tracked.lines) {
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

          <PaymentNotice
            payment={payment}
            cancelled={cancelled}
            paying={paying}
            error={payError}
            onPay={payNow}
          />

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

/**
 * What the money is doing, in the customer's words.
 *
 * Silent on a deployment with no gateway configured — there is nothing truthful
 * and useful to say to a customer about a payment their build was never going
 * to take, and the checkout screen has already told them. It speaks only when
 * payment is real and the order is not settled.
 */
function PaymentNotice({
  payment,
  cancelled,
  paying,
  error,
  onPay,
}: {
  payment: OrderPayment | null;
  cancelled: boolean;
  paying: boolean;
  error: string | null;
  onPay: () => void;
}) {
  if (!payment?.required) return null;
  if (payment.status === 'captured') {
    return (
      <p className="mt-4 rounded-sm bg-paper px-4 py-3 text-xs font-semibold">
        Paid. Your receipt is on its way by email.
      </p>
    );
  }

  // Pending after a redirect means the gateway has the customer's money and has
  // not told us yet. Nothing for them to do but wait, so nothing is offered.
  if (payment.status === 'pending' && !cancelled) {
    return (
      <p role="status" className="mt-4 rounded-sm bg-paper px-4 py-3 text-xs">
        <span className="font-semibold">Confirming your payment.</span> This page updates itself —
        the kitchen starts as soon as it clears.
      </p>
    );
  }

  const heading =
    payment.status === 'failed'
      ? 'That payment did not go through'
      : cancelled
        ? 'You cancelled the payment'
        : 'This order has not been paid for';

  return (
    <div className="mt-4 rounded-sm border border-gold bg-paper px-4 py-3">
      <p className="text-xs font-semibold">{heading}</p>
      <p className="mt-1 text-xs text-muted">
        Your order is held and nothing has been charged. The kitchen starts once the payment clears.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-red">
          {error}
        </p>
      )}
      <Button className="mt-3" size="sm" onClick={onPay} disabled={paying}>
        {paying ? 'Taking you to pay…' : 'Pay for this order'}
      </Button>
    </div>
  );
}
