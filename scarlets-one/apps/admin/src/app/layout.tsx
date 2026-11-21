import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { tokenCss } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Scarlets One operations console (concept)',
    template: '%s · Scarlets One console (concept)',
  },
  description:
    'Operations console for Scarlets One, a supporter-app concept. Not an official Scarlets product. All data is DEMO.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Design tokens from @scarlets/ui as custom properties. Static text, built on the server. */}
        <style dangerouslySetInnerHTML={{ __html: tokenCss() }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <header className="concept-banner">
          <span className="concept-banner__tag" aria-hidden="true">
            Demo
          </span>
          <p>Scarlets One concept. Not an official Scarlets product. All data is DEMO.</p>
        </header>
        {children}
      </body>
    </html>
  );
}
