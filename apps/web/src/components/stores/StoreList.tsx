'use client';

import { SERVICE_MODES, type Store } from '@bbq/types';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { Button } from '@/components/ui/Button';
import { isOpenNow } from '@/lib/trading';

export function StoreList({ stores }: { stores: readonly Store[] }) {
  const { storeId, setStore, hydrated } = useOrdering();

  return (
    <ul className="mt-8 grid gap-6 lg:grid-cols-2">
      {stores.map((store) => {
        const open = hydrated ? isOpenNow(store) : null;
        const selected = storeId === store.id;

        return (
          <li
            key={store.id}
            className={[
              'rounded-md border bg-white p-6',
              selected ? 'border-red shadow-e1' : 'border-line',
            ].join(' ')}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="display text-2xl">{store.name}</h2>
                <p className="mt-1 text-sm text-muted">{store.address}</p>
              </div>
              {open !== null && (
                <span
                  className={[
                    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]',
                    open ? 'bg-red-10 text-red' : 'bg-black-10 text-black-80',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className={['block size-1.5 rounded-full', open ? 'bg-red' : 'bg-black-60'].join(
                      ' ',
                    )}
                  />
                  {open ? 'Open now' : 'Closed'}
                </span>
              )}
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Hours</dt>
                <dd className="mt-1 text-sm">{store.hours.label}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                  Telephone
                </dt>
                <dd className="mt-1 text-sm">
                  <a
                    href={`tel:${store.telephone.replace(/\s/g, '')}`}
                    className="font-semibold hover:text-red"
                  >
                    {store.telephone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                  Services
                </dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {SERVICE_MODES.map((mode) => (
                    <span
                      key={mode}
                      className={[
                        'rounded-full px-2.5 py-1 text-[11px] font-bold',
                        store.services[mode]
                          ? 'bg-paper text-black'
                          : 'bg-paper text-black-40 line-through',
                      ].join(' ')}
                    >
                      {mode}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                  Halaal
                </dt>
                <dd className="mt-1 text-sm">{store.halaal}</dd>
              </div>
            </dl>

            <div className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                Delivers to
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {store.zones.join(' · ')}
              </p>
            </div>

            {/* Drawn in the interface and labelled as such. It is a placeholder
                for a mapping provider, not a map, and carries no location data. */}
            <div
              aria-hidden="true"
              className="relative mt-5 h-28 overflow-hidden rounded-sm border border-line bg-paper"
            >
              <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] [background-size:22px_22px]" />
              <span className="absolute left-1/2 top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-red text-white shadow-e1">
                <svg viewBox="0 0 16 16" className="size-4">
                  <path
                    fill="currentColor"
                    d="M8 0a5.2 5.2 0 0 0-5.2 5.2C2.8 9.1 8 16 8 16s5.2-6.9 5.2-10.8A5.2 5.2 0 0 0 8 0Zm0 7.2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"
                  />
                </svg>
              </span>
              <span className="absolute bottom-2 left-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                Indicative location
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                variant={selected ? 'ghost' : 'red'}
                size="sm"
                onClick={() => setStore(store.id)}
                disabled={selected}
              >
                {selected ? 'Ordering from here' : 'Order from this store'}
              </Button>
              <span className="tabular text-xs text-muted">{store.distanceKm} km away</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
