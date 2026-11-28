import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { site } from '@/content/site';
import { TITLE_SUFFIX } from '@/lib/seo';
import './globals.css';
import { HydrationSignal } from '@/components/site/HydrationSignal';
import { bootScript } from '@/lib/boot-script';

// Archivo, the typeface of the S + T identity: one variable file for every weight.
const archivo = localFont({
  src: '../fonts/archivo-latin-wght-normal.woff2',
  variable: '--font-archivo',
  weight: '100 900',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'Arial'],
  adjustFontFallback: 'Arial',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${TITLE_SUFFIX} | Bungee, SCAD Freefall & Zipline in Soweto`,
    template: `%s | ${TITLE_SUFFIX}`,
  },
  description:
    'Bungee jump 100m from the bridge between the painted Orlando Towers in Soweto. SCAD freefall, a 700m zipline over the Orlando Dam, paintball and a lift ride to a 360° view. Book timed slots online.',
  applicationName: site.name,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  publisher: site.name,
  category: 'travel',
  keywords: [
    'Soweto Towers',
    'Orlando Towers',
    'bungee jump Johannesburg',
    'bungee jump Soweto',
    'SCAD freefall',
    'Orlando Towers bungee',
    'zipline Soweto',
    'things to do in Soweto',
    'team building Johannesburg',
    'adventure activities Gauteng',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: site.name,
    locale: site.locale,
    url: '/',
    title: `${TITLE_SUFFIX} | Soweto, from the top`,
    description: 'A 100m bungee between the painted towers, SCAD freefall, zipline and a 360° view of Soweto. Book a timed slot.',
    images: [{ url: '/og/home.jpg', width: 1200, height: 630, alt: 'The painted Soweto Towers with a bungee jumper beneath the bridge', type: 'image/jpeg' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og/home.jpg'] },
  robots: site.indexable
    ? { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } }
    : { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Soweto Towers', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false, email: false, address: false },
  other: {
    'geo.region': site.address.regionCode,
    'geo.placename': `${site.address.suburb}, ${site.address.city}`,
    'geo.position': `${site.geo.lat};${site.geo.lng}`,
    ICBM: `${site.geo.lat}, ${site.geo.lng}`,
    'mobile-web-app-capable': 'yes',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
  themeColor: '#151412',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-ZA" className={archivo.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Marks JS as available (reveals are opt-in) and holds form taps that land before hydration. */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        {children}
        <HydrationSignal />
      </body>
    </html>
  );
}
