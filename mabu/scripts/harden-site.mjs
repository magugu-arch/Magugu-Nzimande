/**
 * The website's own protection, written into the export so hosting cannot
 * forget it:
 *
 *   dist-web/_headers               Netlify, Cloudflare Pages and the like
 *   dist-web/nginx-security.conf    for a plain nginx or Caddy setup
 *   dist-web/.well-known/security.txt   how to report a problem (RFC 9116)
 *
 * The policy is worked out from what the export actually loads — the bundle
 * from this site, images and fonts from this site, and nothing else. It then
 * checks the export for anything the policy would break, so the rules and the
 * pages cannot drift apart.
 *
 *   npm run harden   (runs as part of npm run export:web)
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib/web.mjs';

const dist = path.join(root, 'dist-web');
if (!fs.existsSync(dist)) throw new Error('No dist-web — run the web export first');

const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://maburestaurant.com').replace(
  /\/$/,
  '',
);
const API_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.maburestaurant.com').replace(
  /\/$/,
  '',
);
const CONTACT = process.env.MABU_SECURITY_CONTACT ?? 'reservations@maburestaurant.com';

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) files.push(full);
  }
})(dist);

/**
 * The export puts one short script in each page to start the app. Rather than
 * allowing inline scripts in general, each one is allowed by its hash: change
 * the script and the policy changes with it.
 */
const inlineScripts = new Map();
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  for (const [, tag, body] of html.matchAll(
    /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g,
  )) {
    if (/application\/ld\+json/.test(tag) || !body.trim()) continue;
    inlineScripts.set(createHash('sha256').update(body).digest('base64'), body.trim().slice(0, 80));
  }
}
const scriptHashes = [...inlineScripts.keys()].map((h) => `'sha256-${h}'`);

/**
 * React Native for Web writes its styles into the page, so styles need
 * 'unsafe-inline'; scripts are limited to this site's own files plus the
 * start-up script above. The app talks to its API and to nothing else.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${API_URL}`,
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const HEADERS = {
  'Content-Security-Policy': CSP,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/* ── The files hosting reads ──────────────────────────────────────────── */

fs.writeFileSync(
  path.join(dist, '_headers'),
  `# Mábu — security headers for Netlify, Cloudflare Pages and the like.
/*
${Object.entries(HEADERS)
  .map(([k, v]) => `  ${k}: ${v}`)
  .join('\n')}

# The pages themselves are rebuilt on every deploy; the bundle is fingerprinted.
/_expo/static/*
  Cache-Control: public, max-age=31536000, immutable
`,
);

fs.writeFileSync(
  path.join(dist, 'nginx-security.conf'),
  `# Mábu — include this inside the server block that serves dist-web.
${Object.entries(HEADERS)
  .map(([k, v]) => `add_header ${k} "${v}" always;`)
  .join('\n')}

# A page per route: /menu is menu.html, /events/<id> is events/<id>/index.html.
location / {
  try_files $uri $uri.html $uri/index.html /index.html;
}
`,
);

const wellKnown = path.join(dist, '.well-known');
fs.mkdirSync(wellKnown, { recursive: true });
const expires = new Date(Date.now() + 365 * 86_400_000).toISOString().replace(/\.\d+Z$/, 'Z');
fs.writeFileSync(
  path.join(wellKnown, 'security.txt'),
  `# If you have found a problem with this site or the Mábu app, please tell us.
Contact: mailto:${CONTACT}
Expires: ${expires}
Preferred-Languages: en
Canonical: ${SITE_URL}/.well-known/security.txt
Policy: ${SITE_URL}/legal/terms
`,
);

/* ── Check the export against the policy ──────────────────────────────── */

const problems = [];

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(dist, file);
  // A script from another origin, or an inline script, would be blocked by the
  // policy — better to find it here than in a browser's console.
  for (const [, src] of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
    if (/^https?:\/\//.test(src) && !src.startsWith(SITE_URL)) {
      problems.push(`${rel}: loads a script from ${src}`);
    }
  }
  for (const [, tag, body] of html.matchAll(
    /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g,
  )) {
    if (/application\/ld\+json/.test(tag) || !body.trim()) continue;
    if (!inlineScripts.has(createHash('sha256').update(body).digest('base64'))) {
      problems.push(`${rel}: has an inline script the policy would block`);
      break;
    }
  }
  for (const [, href] of html.matchAll(/<link[^>]*\shref="([^"]+)"[^>]*rel="stylesheet"/g)) {
    if (/^https?:\/\//.test(href) && !href.startsWith(SITE_URL)) {
      problems.push(`${rel}: loads a stylesheet from ${href}`);
    }
  }
}

console.log(
  `security headers for ${files.length} pages · ${scriptHashes.length} start-up script hash(es) · _headers · nginx-security.conf · security.txt`,
);
if (problems.length) {
  console.error(`\n${problems.length} problem(s) the content policy would block:`);
  for (const p of problems.slice(0, 20)) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('Nothing in the export breaks the content security policy.');
