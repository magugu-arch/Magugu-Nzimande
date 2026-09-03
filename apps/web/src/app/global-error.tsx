'use client';

import { BRAND } from '@bbq/ui/tokens';

/**
 * When the root layout itself throws.
 *
 * The last resort, and the reason it looks different from `error.tsx`: this
 * replaces the layout rather than rendering inside it, so the site chrome, the
 * fonts and every component that assumes them are exactly what is unavailable.
 * It renders its own document and styles itself from the tokens directly —
 * which is also why the colours are read from `BRAND` rather than written down.
 * Raw hex outside the token files fails the brand check, and a page nobody
 * expects to see is precisely where a hardcoded near-enough red would survive.
 *
 * No basket, no menu, no telephone numbers: all three come from the layer that
 * has failed. One link home, which is the only thing that can be trusted to
 * work from here.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-ZA">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          background: BRAND.black,
          color: BRAND.white,
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '46ch' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: BRAND.red,
            }}
          >
            bb.q Chicken
          </p>
          <h1 style={{ margin: '0.75rem 0 0', fontSize: '1.75rem', lineHeight: 1.2 }}>
            The site is having a moment
          </h1>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', lineHeight: 1.7, opacity: 0.7 }}>
            Something failed before the page could be built. Trying again usually clears it.
          </p>

          <div
            style={{
              marginTop: '1.75rem',
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                border: 0,
                borderRadius: '999px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: 'pointer',
                background: BRAND.red,
                color: BRAND.white,
              }}
            >
              Try again
            </button>
            {/*
              A plain anchor, deliberately. `next/link` navigates on the client,
              and the client is what has just failed — a soft navigation from
              here would re-enter the same broken tree. This asks the browser
              for a fresh document, which is the only recovery left.
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                borderRadius: '999px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.85rem',
                fontWeight: 800,
                textDecoration: 'none',
                border: `2px solid ${BRAND.white}`,
                color: BRAND.white,
              }}
            >
              Start again
            </a>
          </div>

          {error.digest && (
            <p style={{ marginTop: '1.5rem', fontSize: '0.7rem', opacity: 0.6 }}>
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
