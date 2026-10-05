import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/nunito-sans/400.css';
import '@fontsource/nunito-sans/600.css';
import '@fontsource/nunito-sans/700.css';
import '@fontsource/nunito-sans/800.css';
import './globals.css';
import { Shell } from '@/components/Shell';

export const metadata: Metadata = {
  title: { default: 'NMU ONE Console', template: '%s · NMU ONE Console' },
  description:
    'Operator console for NMU ONE: notifications, approvals, events, commerce, content, roles and analytics.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#141C2B',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
