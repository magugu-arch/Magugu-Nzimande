import { CRAFT_LINE } from '@bbq/seed';
import { FoodImage } from '@/components/food/FoodImage';
import { ProductCard } from '@/components/menu/ProductCard';
import { ButtonLink } from '@/components/ui/Button';
import { DemoNotice } from '@/components/ui/DemoValue';
import { HeatMeter } from '@/components/ui/HeatMeter';
import { Price } from '@/components/ui/Price';
import { api } from '@/lib/api';

// Availability and store service rules are written by the operations console
// at runtime, so this page is rendered per request. With Postgres behind it
// this becomes cached with a revalidation tag rather than dynamic.
export const dynamic = 'force-dynamic';

const CRAFT_POINTS = [
  {
    title: 'Twice fried',
    copy: 'The first fry cooks the bird through. The second drives the moisture out of the crust, which is what holds the crunch under sauce.',
  },
  {
    title: 'Olive oil',
    copy: 'Fried in olive oil rather than a blended fat, which is the difference you taste in the last piece as much as the first.',
  },
  {
    title: 'Tossed to order',
    copy: 'Nothing sits pre-sauced under a lamp. The sauce goes on after the second fry, once you have chosen it.',
  },
];

export default function HomePage() {
  const products = api.getProducts();
  const sauces = api.getSauces();
  const categories = api.getCategories();
  const stores = api.getStores();

  const hero = products.find((product) => product.slug === 'golden-original') ?? products[0];
  const bestSellers = products.filter((product) => product.tag === 'Best seller');

  return (
    <>
      <section className="relative overflow-hidden bg-black text-white">
        <div className="mx-auto grid w-full max-w-[1240px] items-center gap-8 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div>
            <p className="display inline-flex items-center gap-2.5 text-sm tracking-[0.16em] text-gold">
              <span aria-hidden="true" className="block h-0.5 w-5 bg-gold" />
              Korean fried chicken
            </p>
            <h1 className="display mt-4 text-[clamp(2.5rem,6.4vw,4.6rem)]">
              The crunch that
              <br />
              <span className="text-red">travels</span>
            </h1>
            <p className="mt-4 max-w-[44ch] text-[15px] text-white/70">
              Whole birds, wings and boneless, sauced the moment you order. Delivery and
              collection across Johannesburg, and a table at Cresta Crossing.
            </p>
            <p className="display mt-5 inline-flex items-center gap-2.5 text-[15px] tracking-[0.14em] text-gold">
              <span aria-hidden="true" className="block h-0.5 w-6 bg-gold" />
              {CRAFT_LINE}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/menu">Order now</ButtonLink>
              <ButtonLink href="/stores" variant="ghost-dark">
                Find a store
              </ButtonLink>
            </div>
          </div>

          {hero && (
            <div className="relative">
              <FoodImage
                imageKey={hero.imageKey}
                alt={hero.name}
                crop="wide"
                sizes="(min-width: 1024px) 560px, 92vw"
                priority
                className="w-full rounded-lg object-cover shadow-e3"
              />
              <div className="absolute -bottom-4 left-4 flex items-center gap-3 rounded-full bg-white py-2.5 pl-3 pr-5 text-black shadow-e2 sm:left-6">
                <span className="grid size-10 place-items-center rounded-full bg-red text-xs font-extrabold text-white">
                  01
                </span>
                <span>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                    Best seller
                  </span>
                  <span className="block text-sm font-extrabold">
                    {hero.name} · <Price cents={hero.priceCents} compact className="text-red" />
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-line bg-white">
        <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-5 py-12 md:grid-cols-3">
          {CRAFT_POINTS.map((point, index) => (
            <div key={point.title}>
              <span className="display text-3xl text-red-40">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2 className="display mt-1 text-2xl">{point.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{point.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-5 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="display inline-flex items-center gap-2.5 text-sm tracking-[0.16em] text-red">
              <span aria-hidden="true" className="block h-0.5 w-5 bg-red" />
              Most ordered
            </p>
            <h2 className="display mt-2 text-[clamp(1.9rem,4.2vw,2.9rem)]">Best sellers</h2>
          </div>
          <ButtonLink href="/menu" variant="ghost" size="sm">
            See the full menu
          </ButtonLink>
        </div>

        <ul className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {bestSellers.map((product, index) => (
            <li key={product.slug}>
              <ProductCard product={product} priority={index < 2} />
            </li>
          ))}
        </ul>
        <DemoNotice className="mt-6 max-w-2xl" />
      </section>

      <section className="bg-black text-white">
        <div className="mx-auto w-full max-w-[1240px] px-5 py-14">
          <p className="display inline-flex items-center gap-2.5 text-sm tracking-[0.16em] text-gold">
            <span aria-hidden="true" className="block h-0.5 w-5 bg-gold" />
            The flavour counter
          </p>
          <h2 className="display mt-2 text-[clamp(1.9rem,4.2vw,2.9rem)]">
            Six sauces, one ladder
          </h2>
          <p className="mt-3 max-w-[52ch] text-sm text-white/70">
            Every sauce goes on after the second fry. Start at the bottom of the ladder and work
            up, or split a bird and take two rungs at once.
          </p>

          <ul className="no-scrollbar mt-8 flex gap-4 overflow-x-auto pb-2">
            {sauces.map((sauce) => (
              <li
                key={sauce.name}
                className="w-52 shrink-0 rounded-md border border-white/15 bg-white/5 p-4"
              >
                <h3 className="display text-xl">{sauce.name}</h3>
                <p className="mt-1 text-xs text-white/60">{sauce.note}</p>
                <div className="mt-3">
                  <HeatMeter heat={sauce.heat} onDark />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-5 py-14">
        <h2 className="display text-[clamp(1.9rem,4.2vw,2.9rem)]">Eat by category</h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => {
            const example = products.find((product) => product.category === category.key);
            return (
              <li key={category.key}>
                <a
                  href={`/menu?category=${category.key}`}
                  className="group relative block overflow-hidden rounded-md bg-black text-white shadow-e1"
                >
                  {example && (
                    <FoodImage
                      imageKey={example.imageKey}
                      alt=""
                      crop="wide"
                      sizes="(min-width: 1024px) 280px, 45vw"
                      className="h-40 w-full object-cover opacity-65 transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <span className="absolute inset-0 flex flex-col justify-end p-4">
                    <span className="display text-2xl">{category.label}</span>
                    <span className="mt-1 line-clamp-2 text-xs text-white/70">
                      {category.note}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-5 pb-16">
        <div className="grid gap-5 md:grid-cols-2">
          {stores.map((store) => (
            <div key={store.id} className="rounded-md border border-line bg-white p-6">
              <h2 className="display text-2xl">{store.name}</h2>
              <p className="mt-1.5 text-sm text-muted">{store.address}</p>
              <p className="mt-3 flex flex-wrap gap-2">
                {Object.entries(store.services)
                  .filter(([, enabled]) => enabled)
                  .map(([service]) => (
                    <span
                      key={service}
                      className="rounded-full bg-paper px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]"
                    >
                      {service}
                    </span>
                  ))}
              </p>
              <div className="mt-5">
                <ButtonLink href="/stores" variant="ghost" size="sm">
                  Store details
                </ButtonLink>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
