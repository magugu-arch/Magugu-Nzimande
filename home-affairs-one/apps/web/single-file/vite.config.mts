import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Second build target for the same app: one JavaScript bundle and one
 * stylesheet with every font and image inlined, which
 * scripts/build-single-file.mjs then folds into a single HTML file.
 *
 * The app's screens are reused unchanged. Three things are swapped:
 * the framework's link and navigation (for a hash router that works from a
 * file), and the image lookup (for embedded copies).
 */
const here = import.meta.dirname;
const appSrc = path.resolve(here, '..', 'src');

export default defineConfig({
  root: here,
  base: './',
  logLevel: 'warn',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: path.join(here, 'src/shims/link.tsx') },
      { find: /^next\/navigation$/, replacement: path.join(here, 'src/shims/navigation.ts') },
      { find: /^@\/lib\/assets$/, replacement: path.join(here, 'src/shims/assets.ts') },
      { find: /^@\//, replacement: `${appSrc}/` },
    ],
    dedupe: ['react', 'react-dom'],
  },
  define: {
    'process.env.NEXT_PUBLIC_BASE_PATH': '""',
    'process.env.NEXT_PUBLIC_FLAG_PROFILE': '"prototype"',
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    outDir: path.join(here, '.build'),
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    modulePreload: false,
    // Fonts are small enough to inline; images arrive already inlined.
    assetsInlineLimit: 50_000_000,
    chunkSizeWarningLimit: 50_000,
    rollupOptions: { output: { codeSplitting: false } },
  },
});
