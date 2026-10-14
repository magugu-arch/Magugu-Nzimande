import Link from 'next/link';
import { Photo } from '@/components/media/Photo';
import { ButtonLink } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Section';

const helpful = [
  { label: 'Free learning', href: '/learn' },
  { label: 'Programs', href: '/programs' },
  { label: 'Books', href: '/books' },
  { label: 'Events', href: '/events' },
  { label: 'Contact', href: '/contact' },
];

export default function NotFound() {
  return (
    <section className="relative isolate flex min-h-[80svh] items-center overflow-hidden bg-ink pt-[var(--header-h)]">
      <div className="absolute inset-0 -z-10 opacity-60">
        <Photo id="MG-35" fill sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/30" />
      </div>
      <div className="container-site py-20">
        <Eyebrow className="mb-5">404 — page not found</Eyebrow>
        <h1 className="type-display-lg max-w-2xl">This page has left the stage</h1>
        <p className="type-lede mt-5 max-w-lg text-ivory/75">
          The link may be old, or the page may have moved. Try one of these instead, or search the
          site.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/" arrow>
            Go home
          </ButtonLink>
          <ButtonLink href="/search" variant="secondary">
            Search the site
          </ButtonLink>
        </div>
        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[0.95rem]">
          {helpful.map((h) => (
            <li key={h.href}>
              <Link
                href={h.href}
                className="text-ivory/75 underline-offset-4 hover:text-ivory hover:underline"
              >
                {h.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
