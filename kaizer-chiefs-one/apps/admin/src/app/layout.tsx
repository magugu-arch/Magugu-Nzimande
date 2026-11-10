import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { tokensAsCss } from '@kc-one/ui/css';
import './globals.css';

const inter = localFont({
  src: [
    { path: './fonts/Inter_400Regular.ttf', weight: '400' },
    { path: './fonts/Inter_600SemiBold.ttf', weight: '600' },
    { path: './fonts/Inter_700Bold.ttf', weight: '700' },
  ],
  variable: '--kc-font-inter',
  display: 'swap',
});
const barlow = localFont({
  src: [
    { path: './fonts/BarlowCondensed_700Bold.ttf', weight: '700', style: 'normal' },
    { path: './fonts/BarlowCondensed_700Bold_Italic.ttf', weight: '700', style: 'italic' },
  ],
  variable: '--kc-font-barlow',
  display: 'swap',
});
const mono = localFont({
  src: [{ path: './fonts/DMMono_500Medium.ttf', weight: '500' }],
  variable: '--kc-font-dmmono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KC One Admin (Concept)',
  description: 'Staff console for the proposed Kaizer Chiefs One App. Not an official club system.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`${inter.variable} ${barlow.variable} ${mono.variable}`}>
      <head>
        {/* Generated from packages/ui, the same tokens the mobile app uses. */}
        <style>{tokensAsCss()}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
