'use client';

import type { Product } from '@bbq/types';
import { useState } from 'react';
import { FoodImage } from '@/components/food/FoodImage';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DemoFlag } from '@/components/ui/DemoValue';
import { Price } from '@/components/ui/Price';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { describeOptions } from '@/lib/cart';
import { remainingToFreeDelivery } from '@/lib/pricing';
import { useFocusTrap } from '@/lib/use-focus-trap';
import { useCartDrawer } from './CartDrawerProvider';
import { FreeDeliveryMeter } from './FreeDeliveryMeter';

export function CartDrawer({ suggestions }: { suggestions: readonly Product[] }) {
  const { isOpen, close } = useCartDrawer();
  const { lines, totals, mode, setQuantity, promoCode, applyPromo, clearPromo, addLine } =
    useOrdering();
  const [code, setCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen, close);

  const remaining = remainingToFreeDelivery(totals.subtotalCents - totals.discountCents);

  // Only suggest sides the basket does not already hold.
  const notInBasket = suggestions.filter(
    (product) => !lines.some((line) => line.slug === product.slug),
  );

  function onApplyPromo() {
    const result = applyPromo(code);
    setPromoError(result.ok ? null : result.message);
    if (result.ok) setCode('');
  }

  return (
    <>
      <div
        onClick={close}
        aria-hidden="true"
        className={[
          'fixed inset-0 z-60 bg-black/50 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your basket"
        aria-hidden={!isOpen}
        // inert keeps the closed panel out of the tab order and out of the
        // accessibility tree without unmounting it, so both transitions still
        // have something to animate. It has to be the boolean: React renders a
        // boolean attribute only when the value is truthy, so the empty string
        // this once passed meant the attribute never reached the DOM and a
        // keyboard user could tab into the closed basket.
        inert={!isOpen}
        className={[
          'fixed inset-y-0 right-0 z-70 flex w-full max-w-[420px] flex-col bg-white shadow-e3',
          'transition-transform duration-250 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="display text-2xl">Your basket</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close basket"
            className="grid size-9 place-items-center rounded-full border border-line transition-colors hover:bg-paper"
          >
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
              <path
                fill="currentColor"
                d="m5.3 4 10.7 10.7-1.3 1.3L4 5.3 5.3 4Zm10.7 1.3L5.3 16 4 14.7 14.7 4 16 5.3Z"
              />
            </svg>
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="display text-2xl text-black-60">Nothing in here yet</p>
            <p className="text-sm text-muted">
              Twice fried in olive oil. Tossed to order. Start with a whole bird.
            </p>
            <ButtonLink href="/menu" onClick={close}>
              Browse the menu
            </ButtonLink>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              {mode === 'Delivery' && (
                <FreeDeliveryMeter
                  remainingCents={remaining}
                  subtotalAfterDiscountCents={totals.subtotalCents - totals.discountCents}
                />
              )}

              <ul className="divide-y divide-line">
                {lines.map((line) => (
                  <li key={line.key} className="flex gap-3 py-4">
                    <div className="size-18 shrink-0 overflow-hidden rounded-sm bg-paper">
                      <FoodImage
                        imageKey={line.imageKey}
                        alt=""
                        sizes="72px"
                        className="size-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{line.name}</p>
                      {line.options.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted">{describeOptions(line.options)}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <QuantityStepper
                          quantity={line.quantity}
                          onChange={(next) => setQuantity(line.key, next)}
                          label={line.name}
                        />
                        <Price
                          cents={line.unitCents * line.quantity}
                          className="text-sm font-bold"
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {notInBasket.length > 0 && (
                <section className="border-t border-line py-4">
                  <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                    Goes well with
                  </h3>
                  <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                    {notInBasket.slice(0, 4).map((product) => (
                      <li key={product.slug} className="w-32 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            addLine({
                              slug: product.slug,
                              name: product.name,
                              imageKey: product.imageKey,
                              quantity: 1,
                              unitCents: product.priceCents,
                              options: [],
                            })
                          }
                          className="w-full rounded-sm border border-line p-2 text-left transition-colors hover:border-line-strong hover:bg-paper"
                        >
                          <div className="mb-2 aspect-4/5 overflow-hidden rounded-xs bg-paper">
                            <FoodImage
                              imageKey={product.imageKey}
                              alt=""
                              sizes="128px"
                              className="size-full object-cover"
                            />
                          </div>
                          <span className="block text-xs font-bold leading-tight">
                            {product.name}
                          </span>
                          <Price cents={product.priceCents} compact className="text-xs text-red" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <div className="border-t border-line px-5 py-4">
              {promoCode ? (
                <div className="mb-3 flex items-center justify-between rounded-sm bg-red-10 px-3 py-2 text-sm">
                  <span className="font-bold text-red">{promoCode} applied</span>
                  <button
                    type="button"
                    onClick={clearPromo}
                    className="text-xs font-bold text-muted underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="mb-3">
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <span className="sr-only">Promo code</span>
                      <input
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && onApplyPromo()}
                        placeholder="Promo code"
                        aria-invalid={promoError !== null}
                        aria-describedby={promoError ? 'promo-error' : undefined}
                        className="h-10 w-full rounded-full border border-line px-4 text-sm uppercase placeholder:normal-case placeholder:text-muted"
                      />
                    </label>
                    <Button type="button" variant="ghost" size="sm" onClick={onApplyPromo}>
                      Apply
                    </Button>
                  </div>
                  {promoError && (
                    <p id="promo-error" role="alert" className="mt-1.5 text-xs font-semibold text-red">
                      {promoError}
                    </p>
                  )}
                </div>
              )}

              <dl className="mb-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd>
                    <Price cents={totals.subtotalCents} />
                  </dd>
                </div>
                {totals.discountCents > 0 && (
                  <div className="flex justify-between text-red">
                    <dt className="font-semibold">Discount</dt>
                    <dd className="font-semibold">
                      &minus;<Price cents={totals.discountCents} />
                    </dd>
                  </div>
                )}
                {mode === 'Delivery' && (
                  <div className="flex justify-between">
                    <dt className="flex items-center text-muted">
                      Delivery
                      <DemoFlag />
                    </dt>
                    <dd>
                      {totals.deliveryCents === 0 ? (
                        <span className="font-bold text-red">Free</span>
                      ) : (
                        <Price cents={totals.deliveryCents} />
                      )}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-line pt-2 text-base font-extrabold">
                  <dt>Total</dt>
                  <dd>
                    <Price cents={totals.totalCents} />
                  </dd>
                </div>
              </dl>

              {/* A link, not a button: checkout is a destination, so it earns
                  the browser's own navigation affordances. */}
              <ButtonLink href="/checkout" variant="red" block onClick={close}>
                Checkout
              </ButtonLink>
            </div>
          </>
        )}
      </div>
    </>
  );
}
