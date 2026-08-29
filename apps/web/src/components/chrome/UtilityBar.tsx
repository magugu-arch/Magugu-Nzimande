'use client';

import { SERVICE_MODES, type ServiceMode } from '@bbq/types';
import { DemoFlag } from '@/components/ui/DemoValue';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { isOpenNow } from '@/lib/trading';

export function UtilityBar() {
  const { mode, setMode, store, stores, setStore, hydrated } = useOrdering();
  // Trading status depends on the clock, so it is only rendered once the client
  // has taken over. Deciding it during the server render guarantees a mismatch
  // at 11:00 and 22:00, and a wrong answer either side of it.
  const open = hydrated ? isOpenNow(store) : null;

  return (
    <div className="bg-black text-white">
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2 text-xs">
        <div
          className="flex gap-0.5 rounded-full bg-white/10 p-[3px]"
          role="group"
          aria-label="Fulfilment"
        >
          {SERVICE_MODES.map((candidate: ServiceMode) => {
            const available = store.services[candidate];
            return (
              <button
                key={candidate}
                type="button"
                onClick={() => setMode(candidate)}
                aria-pressed={mode === candidate}
                disabled={!available}
                title={
                  available ? undefined : `${store.name} is not taking ${candidate.toLowerCase()} orders`
                }
                className={[
                  'whitespace-nowrap rounded-full px-3 py-[5px] text-[11px] font-bold uppercase tracking-[0.08em] transition-colors',
                  mode === candidate ? 'bg-red text-white' : 'text-white/70 hover:text-white',
                  available ? '' : 'cursor-not-allowed opacity-40 hover:text-white/70',
                ].join(' ')}
              >
                {candidate}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 font-semibold text-white/80">
          <span className="sr-only">Choose a store</span>
          <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 0a5.2 5.2 0 0 0-5.2 5.2C2.8 9.1 8 16 8 16s5.2-6.9 5.2-10.8A5.2 5.2 0 0 0 8 0Zm0 7.2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"
            />
          </svg>
          <select
            value={store.id}
            onChange={(event) => setStore(event.target.value)}
            className="cursor-pointer rounded-sm bg-transparent font-bold text-white outline-none"
          >
            {stores.map((candidate) => (
              <option key={candidate.id} value={candidate.id} className="text-black">
                {candidate.name}
              </option>
            ))}
          </select>
        </label>

        <span
          className={[
            'flex items-center gap-1.5 font-semibold',
            open === false ? 'text-red-60' : 'text-white/80',
          ].join(' ')}
        >
          {open !== null && (
            <>
              <span
                aria-hidden="true"
                className={['block size-1.5 rounded-full', open ? 'bg-gold' : 'bg-red-60'].join(' ')}
              />
              {open ? 'Open now' : 'Closed'}
              <span className="hidden text-white/50 sm:inline">·</span>
            </>
          )}
          <span className="hidden text-white/50 sm:inline">{store.hours.label}</span>
          <DemoFlag />
        </span>

        <span className="ml-auto hidden items-center gap-3 md:flex">
          <a href="tel:0110000000" className="font-semibold text-white/80 hover:text-white">
            {store.telephone}
          </a>
        </span>
      </div>
    </div>
  );
}
