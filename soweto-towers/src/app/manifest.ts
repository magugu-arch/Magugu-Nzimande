import type { MetadataRoute } from 'next';

/** Installable on Android, iPhone (Add to Home Screen), Mac (Add to Dock) and Windows. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Soweto Towers',
    short_name: 'Soweto Towers',
    description: 'Bungee, SCAD freefall, zipline and a 360° view from the painted Orlando Towers in Soweto. Book, keep your tickets, get tower status.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F3EFE7',
    theme_color: '#151412',
    lang: 'en-ZA',
    dir: 'ltr',
    categories: ['travel', 'sports', 'entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Book your jump', short_name: 'Book', url: '/book?source=pwa-shortcut', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Tower status', short_name: 'Status', url: '/visit?source=pwa-shortcut#status' },
      { name: 'Find my jump', short_name: 'My jump', url: '/find-my-jump?source=pwa-shortcut' },
    ],
    prefer_related_applications: false,
  };
}
