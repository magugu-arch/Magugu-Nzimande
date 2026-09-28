import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { indexablePages, pageSeo, withPageHead } from './src/data/seo.ts';
import { work } from './src/data/work.ts';

/**
 * In development the API runs inside the Vite server, through the same
 * handler Vercel uses in production (server/node.ts), so `npm run dev` is the
 * whole site — booking, mock payment and console email included.
 */
function devApi(): Plugin {
  return {
    name: 'grateful-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          const mod = (await server.ssrLoadModule('/server/node.ts')) as typeof import('./server/node');
          await mod.handleNode(req, res);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

/**
 * Search: robots.txt, sitemap.xml, and one HTML file per public page with its
 * own title, description, canonical address and social tags already in
 * <head> (from src/data/seo.ts), so search engines and link previews that
 * never run JavaScript still see the right page. Vercel serves /about from
 * about.html (cleanUrls). Absolute addresses need the live domain, so the
 * sitemap, canonical tags and og:url are only written when SITE_URL is set.
 * GOOGLE_SITE_VERIFICATION adds Google Search Console's ownership tag.
 */
function seoFiles(): Plugin {
  const site = () => process.env.SITE_URL?.replace(/\/$/, '') || null;
  let outDir = 'dist';
  const pages = indexablePages(work);
  return {
    name: 'grateful-seo-files',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    transformIndexHtml(html) {
      const verify = process.env.GOOGLE_SITE_VERIFICATION?.trim();
      const withVerify = verify ? html.replace('<!--seo:head-->', `<!--seo:head-->\n    <meta name="google-site-verification" content="${verify.replace(/"/g, '')}" />`) : html;
      const s = site();
      return withPageHead(withVerify.replaceAll('%SITE%', s ?? ''), pageSeo['/'], s ? `${s}/` : null);
    },
    generateBundle() {
      const s = site();
      const disallow = ['/payment', '/confirmation', '/unsubscribe', '/studio', '/api/'].map((p) => `Disallow: ${p}`).join('\n');
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\n${disallow}\n${s ? `\nSitemap: ${s}/sitemap.xml\n` : ''}` });
      if (s) {
        const today = new Date().toISOString().slice(0, 10);
        const urls = pages.map((p) => `  <url><loc>${s}${p.path}</loc><lastmod>${today}</lastmod></url>`).join('\n');
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` });
      }
    },
    writeBundle() {
      const s = site();
      const index = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      for (const p of pages) {
        if (p.path === '/') continue;
        const file = resolve(outDir, `.${p.path}.html`);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, withPageHead(index, p.meta, s ? `${s}${p.path}` : null));
      }
    },
  };
}

/** Single-file build: drop links to server paths (they cannot resolve from a file) and embed the favicon. */
function offlineHtml(): Plugin {
  return {
    name: 'grateful-offline-html',
    transformIndexHtml(html) {
      const icon = readFileSync(fileURLToPath(new URL('./public/favicon.svg', import.meta.url)), 'utf8');
      return html
        .replace(/\s*<link rel="preload"[^>]*>/, '')
        .replace(/\s*<meta property="og:image[^>]*>/g, '')
        .replace(/\s*<link rel="(apple-touch-icon|manifest)"[^>]*>/g, '')
        .replaceAll('%SITE%', '')
        .replace('href="/favicon.svg"', `href="data:image/svg+xml,${encodeURIComponent(icon)}"`)
        .replace('<!--seo:head-->', '')
        .replace(/<title>[^<]*<\/title>/, '<title>Grateful — Website Preview</title>');
    },
  };
}

export default defineConfig(({ mode }) => {
  // Server-only variables for the dev API. Only VITE_* ever reach the browser bundle.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''), { ...process.env });
  // `npm run build:single`: the preview as ONE self-contained HTML file —
  // scripts, styles, fonts and photos inlined — that opens from a double-click.
  if (mode === 'single') {
    return {
      base: './',
      plugins: [react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true }), offlineHtml()],
      resolve: { alias: [{ find: /^(.*)\/data\/imageUrls$/, replacement: fileURLToPath(new URL('./src/data/imageUrls.inline.ts', import.meta.url)) }] },
      publicDir: false,
      build: { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false, sourcemap: false },
    };
  }
  return {
    plugins: [react(), tailwindcss(), devApi(), seoFiles()],
    build: { sourcemap: mode !== 'demo' },
  };
});
