import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: { default: 'Crew console', template: '%s · Crew console' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
};

export const viewport: Viewport = {
  themeColor: '#151412',
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
