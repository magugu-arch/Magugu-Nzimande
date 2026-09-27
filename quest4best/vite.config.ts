import { copyFileSync, readdirSync, writeFileSync } from 'node:fs';
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
      // Image entries help the photographs surface in Google Images.
      const photos = readdirSync(resolve(outDir, 'assets'))
        .filter((f) => /\.webp$/.test(f) && !/-640-/.test(f))
        .map((f) => `${base}/assets/${f}`)
        .concat(`${base}/assets/og-image.jpg`);
      const images = photos
        .map((u) => `    <image:image><image:loc>${u}</image:loc></image:image>`)
        .join('\n');
      const lastmod = new Date().toISOString().slice(0, 10);
      writeFileSync(
        resolve(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${base}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
${images}
  </url>
</urlset>
`,
      );
      // One page, anchor navigation: any stray URL should land on the site.
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

// Search-engine ownership tags. Values come from the environment (in CI, the
// GOOGLE_SITE_VERIFICATION and BING_SITE_VERIFICATION repository variables),
// so no code change is needed to verify Google Search Console or Bing.
function verificationTags(env: Record<string, string>): Plugin {
  const tags = [
    ['google-site-verification', env.GOOGLE_SITE_VERIFICATION],
    ['msvalidate.01', env.BING_SITE_VERIFICATION],
  ].filter((t): t is [string, string] => Boolean(t[1]));
  return {
    name: 'quest4best-verification',
    transformIndexHtml: () =>
      tags.map(([name, content]) => ({
        tag: 'meta',
        attrs: { name, content },
        injectTo: 'head' as const,
      })),
  };
}

// Public URL for canonical, Open Graph, robots and sitemap.
// PLACEHOLDER — confirm the production domain before launch.
const DEFAULT_SITE_URL = 'https://quest4best.co.za';

export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Set before Vite resolves its env so %VITE_SITE_URL% in index.html is filled.
  process.env.VITE_SITE_URL = (env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
  // `npm run build:html` — the whole site as one self-contained index.html,
  // with scripts, styles, fonts and photos embedded, for sharing as a file.
  if (env.SINGLE_FILE && isSsrBuild) {
    // Server copy for pre-rendering the single file; images inline the same
    // way as the client build so hydration sees identical markup.
    return {
      base: './',
      build: { outDir: 'dist-ssr-html', assetsInlineLimit: Number.MAX_SAFE_INTEGER },
      plugins: [react()],
    };
  }
  if (env.SINGLE_FILE) {
    return {
      base: './',
      build: { outDir: 'dist-html', assetsInlineLimit: Number.MAX_SAFE_INTEGER },
      plugins: [react(), verificationTags(env), viteSingleFile({ removeViteModuleLoader: true })],
    };
  }

  return {
    base: env.BASE_PATH || '/',
    plugins: [react(), verificationTags(env), siteFiles(process.env.VITE_SITE_URL)],
  };
});
