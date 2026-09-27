import { useState, useSyncExternalStore } from 'react';
import { demo } from '../lib/demoApi';

/**
 * DEMO BUILD ONLY. Says plainly that this is a preview, offers a switch for
 * clearly-labelled sample prices (no real prices have been supplied), and
 * moves between the website and the studio dashboard. Collapses to a small
 * tab so it never sits on top of what someone is trying to read.
 */
export function DemoBanner({ onNavigate }: { onNavigate: (to: string) => void }) {
  const on = useSyncExternalStore(demo.subscribe, () => demo.samplePricing);
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ui-label fixed right-3 bottom-24 z-[45] min-h-11 border border-white/40 bg-black/90 px-4 text-white lg:bottom-4 lg:left-4 lg:right-auto"
      >
        Preview ▴
      </button>
    );
  }

  return (
    <div role="region" aria-label="Preview notice" className="fixed right-3 bottom-24 z-[45] max-w-[19rem] border border-white/30 bg-black/95 p-4 font-sans text-xs leading-relaxed text-white lg:bottom-4 lg:left-4 lg:right-auto">
      <div className="flex items-start justify-between gap-3">
        <p className="ui-label">Preview</p>
        <button type="button" onClick={() => setOpen(false)} className="-mt-3 -mr-3 min-h-11 min-w-11 underline-offset-4 hover:underline">
          Hide
        </button>
      </div>
      <p className="opacity-75">Bookings, payments and messages here are simulated in your browser. Nothing is saved or sent.</p>
      <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={on} onChange={(e) => demo.setSamplePricing(e.target.checked)} className="size-4 accent-white" />
        <span>
          Show payment steps with <strong>sample</strong> prices
        </span>
      </label>
      <div className="flex flex-wrap gap-x-4">
        <button type="button" onClick={() => onNavigate('/')} className="inline-flex min-h-11 items-center underline underline-offset-4">
          Website
        </button>
        <button type="button" onClick={() => onNavigate('/studio')} className="inline-flex min-h-11 items-center underline underline-offset-4">
          Studio dashboard
        </button>
      </div>
    </div>
  );
}
