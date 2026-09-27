import { copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Files whose content depends on the public URL, written after the bundle so
// one build serves the real domain and a preview host alike.
function siteFiles(siteUrl: string): Plugin {
  let outDir = 'dist';
  let skip = false;
  return {
    name: 'quest4best-site-files',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      skip = Boolean(config.build.ssr);
    },
    closeBundle() {
      if (skip) return;
      const base = siteUrl.replace(/\/$/, '');
      writeFileSync(
        resolve(outDir, 'robots.txt'),
        `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`,
      );
      writeFileSync(
        resolve(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc></url>\n</urlset>\n`,
      );
      // One page, anchor navigation: any stray URL should land on the site.
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

// Public URL for canonical, Open Graph, robots and sitemap.
// PLACEHOLDER — confirm the production domain before launch.
const DEFAULT_SITE_URL = 'https://quest4best.co.za';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Set before Vite resolves its env so %VITE_SITE_URL% in index.html is filled.
  process.env.VITE_SITE_URL = (env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
  // `npm run build:html` — the whole site as one self-contained index.html,
  // with scripts, styles, fonts and photos embedded, for sharing as a file.
  if (env.SINGLE_FILE) {
    return {
      base: './',
      build: { outDir: 'dist-html', assetsInlineLimit: Number.MAX_SAFE_INTEGER },
      plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
    };
  }

  return {
    base: env.BASE_PATH || '/',
    plugins: [react(), siteFiles(process.env.VITE_SITE_URL)],
  };
});
