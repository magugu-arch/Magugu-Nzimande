import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrderJourney } from '@/components/journey/OrderJourney';

export const metadata: Metadata = {
  title: 'My journey',
  robots: { index: false, follow: false },
};

export default function JourneyPage() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
      <p className="display inline-flex items-center gap-2.5 text-sm tracking-[0.16em] text-red">
        <span aria-hidden="true" className="block h-0.5 w-5 bg-red" />
        Live
      </p>
      <h1 className="display mt-2 text-[clamp(2.1rem,5vw,3.2rem)]">My journey</h1>

      <div className="mt-8">
        {/* useSearchParams needs a boundary, so the page can still be
            prerendered up to this point. */}
        <Suspense fallback={<p className="text-sm text-muted">Loading your order…</p>}>
          <OrderJourney />
        </Suspense>
      </div>
    </div>
  );
}
