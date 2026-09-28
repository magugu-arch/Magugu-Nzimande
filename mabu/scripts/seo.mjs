/**
 * Finishes the website for search engines, and checks the result.
 *
 *   dist-web/sitemap.xml   every page worth indexing, from the export itself
 *   dist-web/robots.txt    crawl rules and the sitemap's address
 *   dist-web/og.jpg        the picture shown when a link is shared
 *
 * It then checks every indexable page for a title, a description and a
 * canonical address that matches where the page actually lives, and fails
 * the build when two pages would compete for the same search result.
 *
 *   npm run seo            (runs as part of npm run export:web)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { root } from './lib/web.mjs';

const dist = path.join(root, 'dist-web');
if (!fs.existsSync(dist)) throw new Error('No dist-web — run the web export first');

const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://maburestaurant.com').replace(
  /\/$/,
  '',
);
/** Route groups and template files are not pages anyone visits. */
const SKIP = (rel) =>
  rel.includes('[') || rel.startsWith('(') || rel === '_sitemap.html' || rel === '+not-found.html';

/** dist-web/dish/sig-fillet.html → /dish/sig-fillet ; index.html → / */
const urlOf = (rel) => {
  const noExt = rel.replace(/\.html$/, '');
  const clean = noExt.replace(/(^|\/)index$/, '');
  return `/${clean}`.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
};

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '_expo' && entry.name !== 'assets') walk(full);
    } else if (entry.name.endsWith('.html')) {
      files.push(path.relative(dist, full));
    }
  }
})(dist);

const tag = (html, re) => (re.exec(html) ?? [])[1];
const pages = [];
const problems = [];

for (const rel of files.sort()) {
  if (SKIP(rel)) continue;
  const html = fs.readFileSync(path.join(dist, rel), 'utf8');
  const url = urlOf(rel);
  const page = {
    rel,
    url,
    title: tag(html, /<title[^>]*>([\s\S]*?)<\/title>/),
    description: tag(html, /name="description" content="([^"]*)"/),
    canonical: tag(html, /rel="canonical" href="([^"]*)"/),
    robots: tag(html, /name="robots" content="([^"]*)"/) ?? '',
    noindex: /name="robots" content="[^"]*noindex/.test(html),
  };
  pages.push(page);
  if (page.noindex) continue;
  if (!page.title) problems.push(`${url}: no title`);
  if (!page.description) problems.push(`${url}: no description`);
  else if (page.description.length > 165) problems.push(`${url}: description over 165 characters`);
  if (!page.canonical) problems.push(`${url}: no canonical link`);
}

// Two indexable pages must not claim the same title or description: that is
// how a site competes with itself in search results. A page that points its
// canonical at another page (the entry page points at /home) is an alias, and
// is meant to share them.
const selfCanonical = (p) => p.canonical === `${SITE_URL}${p.url === '/' ? '/' : p.url}`;
for (const field of ['title', 'description', 'canonical']) {
  const seen = new Map();
  for (const p of pages.filter((p) => !p.noindex && p[field] && selfCanonical(p))) {
    const key = p[field];
    if (seen.has(key)) problems.push(`${p.url} repeats the ${field} of ${seen.get(key)}`);
    else seen.set(key, p.url);
  }
}

/* ── sitemap.xml ──────────────────────────────────────────────────────── */

const indexable = pages.filter((p) => !p.noindex && p.canonical);
const privatePages = pages.filter((p) => p.noindex);
// The canonical address is what belongs in the sitemap: "/" points at /home.
const locs = [...new Set(indexable.map((p) => p.canonical))].sort();
const today = new Date().toISOString().slice(0, 10);
const priority = (loc) =>
  loc === `${SITE_URL}/home`
    ? '1.0'
    : /\/(menu|book|events|private-functions|visit)$/.test(loc)
      ? '0.9'
      : /\/(dish|wine|events|collection)\//.test(loc)
        ? '0.7'
        : '0.6';
fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs
  .map(
    (loc) =>
      `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${priority(loc)}</priority></url>`,
  )
  .join('\n')}
</urlset>
`,
);

/* ── robots.txt ───────────────────────────────────────────────────────── */

const disallow = [
  '/admin',
  '/profile',
  '/booking',
  '/book/details',
  '/book/review',
  '/sign-in',
  '/notifications',
  '/rewards/redemption',
];
fs.writeFileSync(
  path.join(dist, 'robots.txt'),
  `# Mábu Restaurant — ${SITE_URL}
User-agent: *
Allow: /
${disallow.map((d) => `Disallow: ${d}`).join('\n')}

Sitemap: ${SITE_URL}/sitemap.xml
`,
);

/* ── og.jpg (1200×630, the picture a shared link shows) ───────────────── */

const source = path.join(root, 'assets/photos/masters/signature-steak.jpg');
if (fs.existsSync(source)) {
  await sharp(source)
    .resize(1200, 630, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(dist, 'og.jpg'));
}

/* ── Report ───────────────────────────────────────────────────────────── */

console.log(
  `sitemap ${locs.length} pages · ${privatePages.length} kept out of search · robots.txt · og.jpg`,
);
if (problems.length) {
  console.error(`\n${problems.length} SEO problem(s):`);
  for (const p of problems.slice(0, 40)) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('Every indexable page has a title, a description and its own canonical address.');
