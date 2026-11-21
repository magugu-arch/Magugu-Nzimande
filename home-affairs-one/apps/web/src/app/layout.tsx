import '@fontsource-variable/atkinson-hyperlegible-next/index.css';
import '@fontsource-variable/fraunces/opsz.css';
import '@hao/design-system/tokens.css';
import '@hao/design-system/base.css';
import { prefsBootScript } from '@hao/accessibility';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { withBasePath } from '@/lib/base-path';
import { Providers } from '@/lib/providers';

export const metadata: Metadata = {
  title: {
    default: 'Home Affairs One (concept prototype)',
    template: '%s · Home Affairs One (concept)',
  },
  description:
    'A non-production concept prototype of one trusted front door to identity and civic services. Not an official Department of Home Affairs service.',
  // A prototype that looks like a public service must never be indexed as one.
  robots: { index: false, follow: false },
  manifest: withBasePath('/manifest.webmanifest'),
  icons: {
    icon: [{ url: withBasePath('/icons/icon.svg'), type: 'image/svg+xml' }],
    apple: [{ url: withBasePath('/icons/apple-touch-icon.png') }],
  },
  appleWebApp: { capable: true, title: 'HA One (concept)', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#102a43',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-ZA" suppressHydrationWarning>
      <body>
        {/* Applies saved text-size and contrast choices before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: prefsBootScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
