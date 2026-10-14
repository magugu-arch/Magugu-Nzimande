import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import { PreviewRibbon } from '@/components/layout/PreviewRibbon';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { JsonLd } from '@/components/seo/JsonLd';
import { Consent } from '@/components/system/Consent';
import { RevealObserver } from '@/components/system/RevealObserver';
import { site } from '@/content/site';
import { IS_PREVIEW, SITE_URL } from '@/lib/env';
import { identityJsonLd } from '@/lib/seo';
import './globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${site.name} — Offers, sales and business growth`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.legalEntity }],
  formatDetection: { telephone: false, email: false, address: false },
  robots: IS_PREVIEW ? { index: false, follow: false } : undefined,
};

export const viewport: Viewport = {
  themeColor: '#111114',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh">
        <div id="site-shell" className="flex min-h-dvh flex-col">
          <a
            href="#main"
            className="pressable fixed top-3 left-3 z-[80] -translate-y-24 rounded-full bg-gold px-5 py-2.5 font-semibold text-ink focus:translate-y-0"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <SiteFooter />
        </div>
        <PreviewRibbon />
        <Consent />
        <RevealObserver />
        <JsonLd data={identityJsonLd()} />
      </body>
    </html>
  );
}
