import type { Metadata } from 'next';
import Link from 'next/link';
import { FoodImage } from '@/components/food/FoodImage';
import { ButtonLink } from '@/components/ui/Button';
import { DemoNotice } from '@/components/ui/DemoValue';
import { api } from '@/lib/api';
import { isRunningNow } from '@/lib/promotions';

// Availability and store service rules are written by the operations console
// at runtime, so this page is rendered per request. With Postgres behind it
// this becomes cached with a revalidation tag rather than dynamic.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Offers',
  description: 'Current bb.q Chicken campaigns for delivery, collection and dine-in.',
};

export default function OffersPage() {
  const promotions = api.getPromotions();
  const products = api.getProducts();

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
      <p className="display inline-flex items-center gap-2.5 text-sm tracking-[0.16em] text-red">
        <span aria-hidden="true" className="block h-0.5 w-5 bg-red" />
        Running now
      </p>
      <h1 className="display mt-2 text-[clamp(2.1rem,5vw,3.4rem)]">Offers</h1>
      <p className="mt-3 max-w-[56ch] text-sm text-muted">
        Enter the code in your basket before checking out. One code per order.
      </p>

      <ul className="mt-8 grid gap-6 md:grid-cols-3">
        {promotions.map((promotion) => {
          const product = products.find((candidate) => candidate.slug === promotion.productSlug);
          return (
            <li
              key={promotion.id}
              className="flex flex-col overflow-hidden rounded-md bg-white shadow-e1"
            >
              {product && (
                <FoodImage
                  imageKey={product.imageKey}
                  alt={product.name}
                  crop="wide"
                  sizes="(min-width: 768px) 380px, 92vw"
                  className="h-44 w-full object-cover"
                />
              )}
              <div className="flex flex-1 flex-col p-5">
                <h2 className="display text-2xl">{promotion.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{promotion.copy}</p>

                <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">Code</dt>
                    <dd>
                      <code className="rounded-sm bg-red-10 px-2.5 py-1 text-xs font-extrabold tracking-[0.08em] text-red">
                        {promotion.code}
                      </code>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">Saves</dt>
                    <dd className="tabular font-bold">
                      {Math.round(promotion.discountRate * 100)}% off {product?.name ?? 'the item'}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-muted">Valid</dt>
                    <dd className="text-right text-xs font-semibold">{promotion.validity}</dd>
                  </div>
                </dl>

                {/*
                  Said on the card rather than discovered at checkout. The
                  conditions above are enforced now, so an offer that is not
                  running today would otherwise be an advertised code that
                  silently fails on the last step of an order.
                */}
                {!isRunningNow(promotion) && (
                  <p className="mt-3 rounded-sm bg-paper px-3 py-2 text-xs font-semibold text-muted">
                    Not running right now.
                  </p>
                )}

                <div className="mt-5">
                  {product ? (
                    <ButtonLink href={`/menu/${product.slug}`} size="sm" block>
                      Order {product.name}
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/menu" size="sm" block>
                      Browse the menu
                    </ButtonLink>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-10 rounded-md border border-line bg-white p-5">
        <DemoNotice className="max-w-3xl" />
        <p className="mt-3 text-xs text-muted">
          Campaign codes, discount values and dates are sample data.{' '}
          <Link href="/help" className="font-semibold text-red underline">
            Read the terms
          </Link>
        </p>
      </div>
    </div>
  );
}
