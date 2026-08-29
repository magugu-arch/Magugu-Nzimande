import { CRAFT_LINE } from '@bbq/seed';
import type { Metadata } from 'next';
import { FoodImage } from '@/components/food/FoodImage';
import { Logo } from '@/components/brand/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { HeatMeter } from '@/components/ui/HeatMeter';
import { Price } from '@/components/ui/Price';
import { api } from '@/lib/api';

export const metadata: Metadata = {
  title: 'The app',
  description:
    'The bb.q Chicken ordering app: the same menu, basket and order tracking, on your phone.',
};

/** A phone-shaped frame, so the three screens read as screens rather than crops. */
function DeviceFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="mx-auto w-full max-w-[280px]">
      <div className="rounded-[2.2rem] border-8 border-black bg-black shadow-e3">
        <div className="relative overflow-hidden rounded-[1.6rem] bg-paper">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-black"
          />
          <div className="h-[500px] overflow-hidden">{children}</div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs font-bold uppercase tracking-[0.08em] text-muted">
        {label}
      </figcaption>
    </figure>
  );
}

export default function AppPage() {
  const products = api.getProducts();
  const hero = products.find((product) => product.slug === 'honey-garlic') ?? products[0];
  const listed = products.slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
      <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="display inline-flex items-center gap-2.5 text-sm tracking-[0.16em] text-red">
            <span aria-hidden="true" className="block h-0.5 w-5 bg-red" />
            Coming to the stores
          </p>
          <h1 className="display mt-2 text-[clamp(2.1rem,5vw,3.4rem)]">
            The same crunch,
            <br />
            in your pocket
          </h1>
          <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-muted">
            The app carries the same menu, the same basket and the same live order tracking as
            this site, with saved addresses and points on the home screen.
          </p>
          <p className="display mt-5 inline-flex items-center gap-2.5 text-sm tracking-[0.14em] text-red">
            <span aria-hidden="true" className="block h-0.5 w-6 bg-red" />
            {CRAFT_LINE}
          </p>
          <div className="mt-7">
            <ButtonLink href="/menu">Order on the web meanwhile</ButtonLink>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <DeviceFrame label="Home">
            <div className="bg-black px-4 py-5 text-white">
              <Logo reversed height={18} />
              <p className="display mt-4 text-2xl leading-none">
                The crunch
                <br />
                that travels
              </p>
            </div>
            {hero && (
              <FoodImage
                imageKey={hero.imageKey}
                alt=""
                crop="wide"
                sizes="280px"
                className="h-32 w-full object-cover"
              />
            )}
            <div className="p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                Best sellers
              </p>
              {listed.slice(0, 3).map((product) => (
                <div key={product.slug} className="mt-2 flex items-center gap-2">
                  <div className="size-9 shrink-0 overflow-hidden rounded-xs bg-paper">
                    <FoodImage
                      imageKey={product.imageKey}
                      alt=""
                      sizes="36px"
                      className="size-full object-cover"
                    />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold">
                    {product.name}
                  </span>
                  <Price cents={product.priceCents} compact className="text-[11px] text-red" />
                </div>
              ))}
            </div>
          </DeviceFrame>

          <DeviceFrame label="Product">
            {hero && (
              <>
                <FoodImage
                  imageKey={hero.imageKey}
                  alt=""
                  sizes="280px"
                  className="h-56 w-full object-cover"
                />
                <div className="p-3">
                  <p className="display text-xl leading-tight">{hero.name}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Price cents={hero.priceCents} compact className="text-sm font-extrabold text-red" />
                    <HeatMeter heat={hero.heat} />
                  </div>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                    Size
                  </p>
                  <div className="mt-1.5 flex gap-1.5">
                    <span className="rounded-full bg-red px-2.5 py-1 text-[10px] font-bold text-white">
                      Whole bird
                    </span>
                    <span className="rounded-full border border-line px-2.5 py-1 text-[10px] font-bold">
                      Half bird
                    </span>
                  </div>
                  <div className="mt-4 rounded-full bg-red py-2 text-center text-[11px] font-bold text-white">
                    Add to basket
                  </div>
                </div>
              </>
            )}
          </DeviceFrame>

          <DeviceFrame label="Order tracking">
            <div className="bg-black px-4 py-5 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gold">
                Order number
              </p>
              <p className="tabular display mt-1 text-xl">BBQ-260829-0001</p>
            </div>
            <ol className="p-4">
              {[
                { label: 'Order received', done: true },
                { label: 'Preparing', done: true },
                { label: 'Ready', done: false },
                { label: 'On the way', done: false },
                { label: 'Delivered', done: false },
              ].map((step, index) => (
                <li key={step.label} className="flex items-center gap-2.5 py-2">
                  <span
                    aria-hidden="true"
                    className={[
                      'grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-extrabold',
                      step.done ? 'bg-red text-white' : 'border border-line text-black-40',
                    ].join(' ')}
                  >
                    {step.done ? '✓' : index + 1}
                  </span>
                  <span
                    className={[
                      'text-[11px] font-bold',
                      step.done ? 'text-black' : 'text-black-40',
                    ].join(' ')}
                  >
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>
          </DeviceFrame>
        </div>
      </div>
    </div>
  );
}
