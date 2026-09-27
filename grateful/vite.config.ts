import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

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
 * robots.txt and sitemap.xml, written at build time. The sitemap needs the
 * real domain, so it is only emitted when SITE_URL is set for the build.
 */
const ROUTES = ['/', '/work', '/work/garment-study-01', '/work/garment-study-02', '/work/garment-study-03', '/about', '/services', '/booking', '/contact', '/privacy'];

function seoFiles(): Plugin {
  return {
    name: 'grateful-seo-files',
    apply: 'build',
    generateBundle() {
      const site = process.env.SITE_URL?.replace(/\/$/, '');
      const disallow = ['/payment', '/confirmation', '/unsubscribe', '/studio', '/api/'].map((p) => `Disallow: ${p}`).join('\n');
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\n${disallow}\n${site ? `\nSitemap: ${site}/sitemap.xml\n` : ''}` });
      if (site) {
        const urls = ROUTES.map((r) => `  <url><loc>${site}${r === '/' ? '/' : r}</loc></url>`).join('\n');
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` });
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
        .replace(/\s*<meta property="og:image"[^>]*>/, '')
        .replace('href="/favicon.svg"', `href="data:image/svg+xml,${encodeURIComponent(icon)}"`)
        .replace('<title>Grateful — Fashion designed around your identity</title>', '<title>Grateful — Website Preview</title>');
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
