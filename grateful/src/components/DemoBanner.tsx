import { useSyncExternalStore } from 'react';
import { demo } from '../lib/demoApi';

/**
 * DEMO BUILD ONLY. Says plainly that this is a preview, and offers a switch
 * that gives the services clearly-labelled sample prices so the deposit and
 * checkout steps can be seen. No real prices have been supplied.
 */
export function DemoBanner() {
  const on = useSyncExternalStore(demo.subscribe, () => demo.samplePricing);
  return (
    <div role="region" aria-label="Preview notice" className="fixed right-3 bottom-24 z-[45] max-w-[19rem] border border-white/30 bg-black/90 p-4 font-sans text-xs leading-relaxed text-white backdrop-blur lg:bottom-4 lg:left-4 lg:right-auto">
      <p className="ui-label">Preview</p>
      <p className="mt-1 opacity-75">Bookings, payments and messages here are simulated in your browser. Nothing is saved or sent.</p>
      <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={on} onChange={(e) => demo.setSamplePricing(e.target.checked)} className="size-4 accent-white" />
        <span>Show payment steps with <strong>sample</strong> prices</span>
      </label>
    </div>
  );
}
