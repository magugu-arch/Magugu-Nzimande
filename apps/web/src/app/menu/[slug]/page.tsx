import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FoodImage } from '@/components/food/FoodImage';
import { ProductConfigurator } from '@/components/menu/ProductConfigurator';
import { DemoFlag } from '@/components/ui/DemoValue';
import { HeatMeter } from '@/components/ui/HeatMeter';
import { Price } from '@/components/ui/Price';
import { api } from '@/lib/api';

// Availability and store service rules are written by the operations console
// at runtime, so this page is rendered per request. With Postgres behind it
// this becomes cached with a revalidation tag rather than dynamic.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = api.getProduct(slug);
  if (!product) return { title: 'Not found' };
  return { title: product.name, description: product.description };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = api.getProduct(slug);
  if (!product) notFound();

  const related = api
    .getProducts()
    .filter((candidate) => candidate.category === product.category && candidate.slug !== slug)
    .slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-xs font-semibold text-muted">
        <Link href="/menu" className="hover:text-black">
          Menu
        </Link>
        <span aria-hidden="true" className="mx-2">
          /
        </span>
        <span>{product.category}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="overflow-hidden rounded-lg bg-paper shadow-e1">
            <FoodImage
              imageKey={product.imageKey}
              alt={product.name}
              sizes="(min-width: 1024px) 560px, 92vw"
              priority
              className="w-full object-cover"
            />
          </div>

          <section className="mt-6 rounded-md border border-line bg-white p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
              Allergens and energy
            </h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Contains</dt>
                <dd className="text-sm font-bold">{product.nutrition.allergens}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Indicative energy</dt>
                <dd className="tabular text-sm font-bold">
                  {product.nutrition.kilojoules.toLocaleString('en-ZA')} kJ
                </dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start text-xs leading-relaxed text-muted">
              <span>
                Indicative values pending the franchisor nutritional analysis. Prepared in a
                kitchen that handles wheat, soya, milk, egg, sesame and fish.
              </span>
              <DemoFlag />
            </p>
          </section>
        </div>

        <div>
          {product.tag && (
            <span className="mb-3 inline-block rounded-full bg-yellow px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-black">
              {product.tag}
            </span>
          )}
          <h1 className="display text-[clamp(2.1rem,5vw,3.2rem)]">{product.name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <span className="text-2xl font-extrabold text-red">
              <Price cents={product.priceCents} compact />
            </span>
            <HeatMeter heat={product.heat} />
            <span className="text-xs font-semibold text-muted">{product.sauce}</span>
            <DemoFlag label="Demo price" />
          </div>

          <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-muted">
            {product.description}
          </p>

          <hr className="my-7 border-line" />

          <ProductConfigurator product={product} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="display text-2xl">More {product.category.toLowerCase()}</h2>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((candidate) => (
              <li key={candidate.slug}>
                <Link
                  href={`/menu/${candidate.slug}`}
                  className="group flex gap-3 rounded-md border border-line bg-white p-3 transition-colors hover:border-line-strong"
                >
                  <div className="size-16 shrink-0 overflow-hidden rounded-sm bg-paper">
                    <FoodImage
                      imageKey={candidate.imageKey}
                      alt=""
                      sizes="64px"
                      className="size-full object-cover"
                    />
                  </div>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight">{candidate.name}</span>
                    <span className="mt-1 block text-xs text-red">
                      <Price cents={candidate.priceCents} compact />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
