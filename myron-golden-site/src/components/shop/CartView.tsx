'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useActionState, useEffect, useState, useSyncExternalStore } from 'react';
import { type CheckoutState, startBookCheckout } from '@/app/cart/actions';
import { track } from '@/lib/analytics';
import { formatUsd } from '@/lib/booking';
import { cn } from '@/lib/cn';
import { springs } from '@/lib/motion';
import {
  type CartLine,
  copiesLabel,
  normaliseCart,
  serialiseCart,
  type ShopItem,
  summariseCart,
} from '@/lib/shop';
import { Honeypot } from '../forms/Field';
import { buttonClasses } from '../ui/Button';
import { Rolling } from '../ui/Rolling';
import { Pill } from '../ui/Section';
import { AlertIcon, BagIcon, LockIcon } from '../ui/icons';
import { cart, useCartLines } from './cart-store';

const noop = () => () => {};
const initial: CheckoutState = { status: 'idle' };

/**
 * The cart: one line per book with a quantity picker and Remove, a summary
 * with the subtotal and one checkout button, and Clear cart. Clearing is
 * forgiving rather than guarded — no "are you sure?", just an Undo for a few
 * seconds afterwards. Lines leave on a critically damped spring and the rest
 * close the gap; with reduced motion they simply fade.
 */
export function CartView({
  catalog,
  checkoutReady,
  shippingReady,
  preview,
}: {
  catalog: ShopItem[];
  /** Payments (and, in production, shipping) are set up. */
  checkoutReady: boolean;
  shippingReady: boolean;
  preview: boolean;
}) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const cancelled = useSyncExternalStore(
    noop,
    () => new URLSearchParams(window.location.search).get('checkout') === 'cancelled',
    () => false,
  );
  const raw = useCartLines();
  const lines = normaliseCart(raw, catalog);
  const summary = summariseCart(lines, catalog);
  const [state, action, pending] = useActionState(startBookCheckout, initial);
  const [undo, setUndo] = useState<CartLine[] | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 10_000);
    return () => clearTimeout(timer);
  }, [undo]);

  const changeQty = (line: CartLine, item: ShopItem, qty: number) => {
    setDirection(qty >= line.qty ? 1 : -1);
    cart.set(line.slug, qty, item.maxPerOrder);
  };

  const catalogData = JSON.stringify(
    catalog.map((i) => ({
      slug: i.slug,
      title: i.title,
      priceCents: i.priceCents,
      demo: i.isDemoPrice,
      max: i.maxPerOrder,
      cover: i.cover?.src ?? null,
      placeholder: i.cover?.placeholder ?? false,
    })),
  );

  return (
    <div data-cart-root data-catalog={catalogData} data-checkout-ready={checkoutReady || preview}>
      <div className="space-y-4" aria-live="polite">
        {cancelled ? (
          <Notice tone="info">
            Checkout was cancelled. Nothing was charged, and your cart is as you left it.
          </Notice>
        ) : null}
        {state.status === 'error' ? (
          <Notice tone="error" role="alert">
            {state.message}
          </Notice>
        ) : null}
        {state.status === 'payments-off' ? (
          <Notice tone="info" role="alert">
            <strong className="block font-semibold text-gold-bright">
              Checkout is not available yet
            </strong>
            {state.message}{' '}
            <Link href="/books" className="underline">
              See the books
            </Link>
            .
            {state.detail ? (
              <span className="mt-2 block text-[0.8rem] text-ivory/65">
                Preview: {state.detail}
              </span>
            ) : null}
          </Notice>
        ) : null}
      </div>

      {!hydrated ? (
        <div className="mt-8 h-64 animate-pulse rounded-[1.5rem] bg-ink/60" aria-hidden="true" />
      ) : summary.lines.length === 0 ? (
        <div className="mt-8 rounded-[1.5rem] bg-ink/60 px-6 py-14 text-center ring-1 ring-ivory/10">
          {undo ? (
            <p role="status" className="mb-8 flex flex-wrap items-center justify-center gap-3">
              <span>Cart cleared.</span>
              <button
                type="button"
                onClick={() => {
                  cart.restore(undo);
                  setUndo(null);
                }}
                className={buttonClasses('secondary')}
              >
                Undo
              </button>
            </p>
          ) : null}
          <BagIcon size={40} className="mx-auto text-gold" />
          <h2 className="mt-5 font-display text-[2rem] leading-tight font-semibold">
            Your cart is empty
          </h2>
          <p className="mt-2 text-ivory/70">Books you add appear here.</p>
          <Link href="/books" className={cn(buttonClasses('primary', 'lg'), 'mt-8')}>
            Browse books
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14">
          <section aria-labelledby="cart-items-title" className="min-w-0">
            <h2 id="cart-items-title" className="sr-only">
              Books in your cart
            </h2>
            <ul className="border-t border-ivory/10">
              <AnimatePresence mode="popLayout" initial={false}>
                {summary.lines.map((line) => (
                  <motion.li
                    key={line.slug}
                    layout={!reduce}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
                    transition={springs.settle}
                    className="flex gap-4 border-b border-ivory/10 py-6 sm:gap-6"
                  >
                    <div className="relative aspect-[1145/1374] w-16 shrink-0 overflow-hidden rounded-lg bg-midnight ring-1 ring-ivory/10 sm:w-20">
                      {line.item.cover ? (
                        <Image
                          src={line.item.cover.src}
                          alt=""
                          fill
                          sizes="5rem"
                          quality={70}
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 className="font-display text-[1.5rem] leading-tight font-semibold">
                          <Link href={`/books/${line.slug}`} className="hover:text-gold-bright">
                            {line.item.title}
                          </Link>
                        </h3>
                        <p className="font-semibold tabular-nums">{formatUsd(line.lineCents)}</p>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.875rem] text-ivory/65">
                        <span className="tabular-nums">{formatUsd(line.item.priceCents)} each</span>
                        {line.item.isDemoPrice ? <Pill tone="demo">Demo price</Pill> : null}
                        {line.item.cover?.placeholder ? (
                          <Pill tone="muted">Placeholder cover</Pill>
                        ) : null}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                        <label className="flex items-center gap-2 text-[0.875rem] text-ivory/75">
                          Quantity
                          <select
                            value={line.qty}
                            onChange={(e) => changeQty(line, line.item, Number(e.target.value))}
                            aria-label={`Quantity of ${line.item.title}`}
                            className="h-10 rounded-xl border border-ivory/15 bg-ink/60 px-3 text-ivory tabular-nums [color-scheme:dark] hover:border-ivory/30 focus:border-gold focus:outline-none"
                          >
                            {Array.from({ length: line.item.maxPerOrder }, (_, i) => i + 1).map(
                              (n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setDirection(-1);
                            cart.remove(line.slug);
                          }}
                          className="pressable text-[0.875rem] font-semibold text-ivory/70 underline-offset-4 hover:text-ivory hover:underline"
                        >
                          Remove<span className="sr-only"> {line.item.title}</span>
                        </button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <Link href="/books" className="font-semibold text-gold-bright hover:text-ivory">
                ← Keep shopping
              </Link>
              <button
                type="button"
                onClick={() => setUndo(cart.clear())}
                className={buttonClasses('secondary')}
              >
                Clear cart
              </button>
            </div>
          </section>

          <aside
            aria-label="Order summary"
            className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start"
          >
            <div className="rounded-[1.5rem] bg-ink/70 p-6 ring-1 ring-ivory/10">
              <h2 className="font-display text-[1.75rem] leading-tight font-semibold">Summary</h2>
              <dl className="mt-5 space-y-3 text-[0.95rem]">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ivory/75">Subtotal ({copiesLabel(summary.count)})</dt>
                  <dd className="font-display text-[1.625rem] leading-none font-semibold">
                    <Rolling value={formatUsd(summary.subtotalCents)} direction={direction} />
                    <span className="sr-only" aria-live="polite">
                      {`${copiesLabel(summary.count)}, subtotal ${formatUsd(summary.subtotalCents)}`}
                    </span>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-ivory/10 pt-3">
                  <dt className="text-ivory/75">Shipping</dt>
                  <dd className="text-right text-ivory/80">
                    {shippingReady ? 'Added at checkout' : 'Not set up yet'}
                  </dd>
                </div>
              </dl>
              {summary.hasDemoPrices ? (
                <p className="mt-4 text-[0.8rem] text-gold-bright">
                  Demo prices: the real prices are still to be confirmed.
                </p>
              ) : null}

              {checkoutReady || preview ? (
                <form
                  action={action}
                  onSubmit={() => track('begin_checkout', { books: summary.count })}
                  className="mt-6 space-y-3"
                >
                  <Honeypot />
                  <input type="hidden" name="items" value={serialiseCart(lines)} />
                  {!checkoutReady ? (
                    <p className="rounded-xl bg-[#1d1810] px-4 py-3 text-[0.85rem] text-gold-bright ring-1 ring-gold/25">
                      Preview: payments are not connected, so checkout stops before Stripe and
                      nothing is charged.
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={pending}
                    className={cn(buttonClasses('primary', 'lg'), 'w-full')}
                  >
                    <LockIcon size={18} />
                    {pending ? 'Opening checkout…' : 'Check out'}
                  </button>
                  <p className="text-center text-[0.8rem] text-ivory/60">
                    You pay on Stripe’s secure checkout page, where you also add your delivery
                    address. Card details never reach this site.
                  </p>
                </form>
              ) : (
                <p className="mt-6 rounded-xl bg-ink/60 p-4 text-[0.9rem] text-ivory/80 ring-1 ring-ivory/10">
                  Online payment is not available yet. Each book can be bought from its{' '}
                  <Link href="/books" className="underline">
                    official page
                  </Link>
                  .
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Notice({
  tone,
  role = 'status',
  children,
}: {
  tone: 'info' | 'error';
  role?: 'status' | 'alert';
  children: React.ReactNode;
}) {
  return (
    <p
      role={role}
      className={cn(
        'flex items-start gap-2.5 rounded-2xl p-4 text-[0.925rem]',
        tone === 'error'
          ? 'bg-[#3a1d18] text-[#f0b4a8] ring-1 ring-[#e8a598]/40'
          : 'bg-[#2c2414] text-ivory/85 ring-1 ring-gold/35',
      )}
    >
      <AlertIcon size={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
