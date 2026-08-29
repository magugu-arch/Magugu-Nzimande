import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, Montserrat } from 'next/font/google';
import './globals.css';

// next/font downloads these at build time and serves them from our own origin as
// woff2, so the site holds its shape with no request to a font service. Replace
// with the licensed master files when they are supplied (CLAUDE.md section 8).
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});

const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas',
  display: 'swap',
  fallback: ['Oswald', 'Arial Narrow', 'Impact', 'sans-serif'],
});

export const metadata: Metadata = {
  title: {
    default: 'bb.q Chicken South Africa | Order online',
    template: '%s | bb.q Chicken South Africa',
  },
  description:
    'Order bb.q Chicken online for delivery, collection or dine-in. Twice fried in olive oil. Tossed to order.',
  openGraph: {
    title: 'bb.q Chicken South Africa',
    description:
      'Korean fried chicken. Twice fried in olive oil. Tossed to order. Delivery, collection and dine-in.',
    type: 'website',
    locale: 'en_ZA',
  },
};

export const viewport: Viewport = {
  themeColor: '#221E1F',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`${montserrat.variable} ${bebas.variable}`}>
      <body>{children}</body>
    </html>
  );
}
