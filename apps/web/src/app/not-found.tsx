import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/Button';

/**
 * A page that is not here.
 *
 * There was no such file, so `notFound()` — which the product route calls
 * deliberately for an unknown slug — landed on the framework's default: a bare
 * white page with the word "404" on it, in a site where every other screen is
 * held to the brand rules.
 *
 * The links out are the two a customer arriving here actually wants. A 404 with
 * nothing to press is a 404 that ends the visit.
 */

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-20">
      <div className="mx-auto max-w-[52ch] text-center">
        <p className="display inline-flex items-center gap-2.5 text-sm tracking-[0.16em] text-red">
          <span aria-hidden="true" className="block h-0.5 w-5 bg-red" />
          404
        </p>
        <h1 className="display mt-2 text-[clamp(2.1rem,5vw,3.4rem)]">
          That page has moved on
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The link may be old, or the item may have come off the menu. Everything we are cooking
          today is on the menu page.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/menu">Browse the menu</ButtonLink>
          <ButtonLink href="/stores" variant="black">
            Find a store
          </ButtonLink>
          <ButtonLink href="/help" variant="ghost">
            Get help
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
