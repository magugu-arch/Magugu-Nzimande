import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
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
      // RFC 9116: where to report a security problem. Refreshed on every build.
      const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
      mkdirSync(resolve(outDir, '.well-known'), { recursive: true });
      writeFileSync(
        resolve(outDir, '.well-known/security.txt'),
        `Contact: mailto:hello@quest4best.co.za\nExpires: ${expires}\nPreferred-Languages: en\nCanonical: ${base}/.well-known/security.txt\n`,
      );
      // Serve dot-folders such as .well-known as-is on GitHub Pages.
      writeFileSync(resolve(outDir, '.nojekyll'), '');
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

// Content Security Policy for the hosted build: only the site's own scripts,
// styles, fonts and images may load, and the form may only talk to itself,
// the visitor's mail app or the configured https form service. GitHub Pages
// cannot send headers, so this ships as a <meta> tag; public/_headers adds
// the header-only protections on hosts that support them.
export function contentSecurityPolicy(
  extra: { script?: string[]; style?: string[] } = {},
  formEndpoint = '',
) {
  let formOrigin = '';
  try {
    if (/^https:\/\//.test(formEndpoint)) formOrigin = new URL(formEndpoint).origin;
  } catch {
    formOrigin = '';
  }
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", ...(extra.script ?? [])],
    'style-src': ["'self'", ...(extra.style ?? [])],
    'img-src': ["'self'", 'data:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", formOrigin].filter(Boolean),
    'form-action': ["'self'", 'mailto:', formOrigin].filter(Boolean),
    'manifest-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'upgrade-insecure-requests': [],
  };
  return Object.entries(directives)
    .map(([k, v]) => [k, ...v].join(' '))
    .join('; ');
}

function securityMeta(csp: string): Plugin {
  return {
    name: 'quest4best-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
        injectTo: 'head-prepend',
      },
    ],
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
      define: { __SINGLE_FILE__: 'true' },
      plugins: [react()],
    };
  }
  if (env.SINGLE_FILE) {
    return {
      base: './',
      build: { outDir: 'dist-html', assetsInlineLimit: Number.MAX_SAFE_INTEGER },
      define: { __SINGLE_FILE__: 'true' },
      // The CSP for the single file is added by scripts/finish-html.mjs,
      // which hashes the inlined script and styles once they exist.
      plugins: [react(), verificationTags(env), viteSingleFile({ removeViteModuleLoader: true })],
    };
  }

  return {
    base: env.BASE_PATH || '/',
    define: { __SINGLE_FILE__: 'false' },
    plugins: [
      react(),
      verificationTags(env),
      securityMeta(contentSecurityPolicy({}, env.VITE_FORM_ENDPOINT)),
      siteFiles(process.env.VITE_SITE_URL),
    ],
  };
});
