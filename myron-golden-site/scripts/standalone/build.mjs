#!/usr/bin/env node
/**
 * Single-file export: the whole site as one self-contained, downloadable
 * HTML file — every page, the styles, the fonts and the images inside it,
 * with full document metadata and the review trail (asset register, sources,
 * outstanding confirmations) embedded as JSON.
 *
 *   npm run build && npm run export:html
 *   npm run export:html -- --base http://localhost:3000 --site-url https://example.com
 *
 * Without --base it starts `next start` on a spare port itself. Pages are
 * captured with JavaScript off, so what goes into the file is exactly the
 * server-rendered HTML; scripts/standalone/runtime.js then adds routing and
 * the interactions. Output: dist/myron-golden-site.html
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split('--')
    .filter(Boolean)
    .map((part) => {
      const [k, ...v] = part.trim().split(' ');
      return [k, v.join(' ')];
    }),
);

const out = path.resolve(projectRoot, args.out || 'dist/myron-golden-site.html');
const siteUrl = (
  args['site-url'] ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://myrongolden.com'
).replace(/\/+$/, '');

// ------------------------------------------------------------------ server

let server = null;
let base = args.base?.replace(/\/+$/, '');
if (!base) {
  const port = 3456;
  base = `http://localhost:${port}`;
  server = spawn('npx', ['next', 'start', '-p', String(port)], {
    cwd: projectRoot,
    stdio: 'ignore',
    detached: true,
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

function stopServer() {
  if (server?.pid) {
    try {
      process.kill(-server.pid);
    } catch {
      // already gone
    }
  }
}

process.on('exit', stopServer);

// ------------------------------------------------------------------ capture

/**
 * Runs in the page. Cleans a subtree for the export: no scripts or React
 * markers, images reduced to asset references, internal links turned into
 * hash routes, forms marked so the runtime can explain they cannot send.
 */
function processInPage({ selector, route, keep }) {
  const assetOf = (raw) => {
    if (!raw) return null;
    const first = raw.split(',')[0].trim().split(' ')[0];
    const url = new URL(first, location.href);
    const target =
      url.pathname === '/_next/image'
        ? decodeURIComponent(url.searchParams.get('url') || '')
        : url.pathname;
    return target.startsWith('/images/myron/') ? target.split('/').pop() : null;
  };

  // Prerendered Suspense content arrives as a hidden <div id="S:n"> that an
  // inline $RC("B:n","S:n") script swaps in for the fallback. Scripts are off
  // during capture, so make the same swap here, or the export would keep the
  // loading placeholder instead of the content. Idempotent across calls.
  const swaps = [];
  document.querySelectorAll('script').forEach((s) => {
    for (const m of s.textContent.matchAll(/\$RC\("([^"]+)","([^"]+)"\)/g))
      swaps.push([m[1], m[2]]);
  });
  for (const [boundaryId, segmentId] of swaps) {
    const segment = document.getElementById(segmentId);
    const marker = document.getElementById(boundaryId)?.previousSibling; // <!--$?-->
    if (!segment || !marker) continue;
    const parent = marker.parentNode;
    let n = marker.nextSibling;
    let depth = 0;
    while (n) {
      if (n.nodeType === Node.COMMENT_NODE) {
        if (n.data === '/$') {
          if (depth === 0) break;
          depth--;
        } else if (n.data === '$' || n.data === '$?' || n.data === '$!') depth++;
      }
      const next = n.nextSibling;
      n.remove();
      n = next;
    }
    while (segment.firstChild) parent.insertBefore(segment.firstChild, n);
    segment.remove();
  }

  const source = document.querySelector(selector);
  if (!source) return null;
  const node = source.cloneNode(true);

  node.querySelectorAll('script, template, noscript, link').forEach((n) => n.remove());
  node.querySelectorAll('div[hidden][id^="S:"]').forEach((n) => n.remove());
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.remove());

  node.querySelectorAll('img').forEach((img) => {
    const file = assetOf(img.getAttribute('srcset')) || assetOf(img.getAttribute('src'));
    if (file) img.setAttribute('data-sa', file);
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.removeAttribute('src');
  });
  node.querySelectorAll('source').forEach((s) => {
    const file = assetOf(s.getAttribute('srcset'));
    if (file) s.setAttribute('data-sa', file);
    s.removeAttribute('srcset');
  });

  node.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (href.startsWith('/') && !href.startsWith('//')) a.setAttribute('href', `#${href}`);
    else if (href.startsWith('#') && !keep.includes(href))
      a.setAttribute('href', `#${route}${href}`);
  });

  node.querySelectorAll('form').forEach((form) => {
    ['action', 'method', 'enctype', 'encType'].forEach((attr) => form.removeAttribute(attr));
    // The demo payment page has its own handler in the runtime.
    if (form.getAttribute('role') !== 'search' && !form.hasAttribute('data-demo-checkout')) {
      form.setAttribute('data-offline-form', '');
    }
    form.querySelectorAll('input[name^="$ACTION"]').forEach((i) => i.remove());
  });

  return { html: selector === 'main' ? node.innerHTML : node.outerHTML };
}

function linksInPage() {
  return Array.from(document.querySelectorAll('a[href^="/"]'))
    .map((a) => a.getAttribute('href'))
    .filter((h) => !h.startsWith('//'))
    .map((h) => new URL(h, location.href).pathname.replace(/\/+$/, '') || '/');
}

function shellInPage() {
  return {
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
    shellClass: document.getElementById('site-shell')?.className ?? '',
    mainClass: document.querySelector('main')?.className ?? '',
    stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.href),
    jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(
      (s) => s.textContent,
    ),
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content ?? '',
  };
}

const executablePath = existsSync('/opt/pw-browsers/chromium')
  ? '/opt/pw-browsers/chromium'
  : undefined;
const browser = await chromium.launch({ executablePath });
const context = await browser.newContext({ javaScriptEnabled: false });
const page = await context.newPage();

const skip = (p) =>
  p.startsWith('/_next') || /\.[a-z0-9]+$/i.test(p) || p === '/site-metadata.json';

// The payment page is reached by script (Check out), not by a link, so seed it.
const queue = ['/', '/search', '/review', '/checkout/demo'];
const seen = new Set(queue);
const pages = [];

while (queue.length) {
  const route = queue.shift();
  const res = await page.goto(base + route, { waitUntil: 'load' });
  if (!res || res.status() !== 200) {
    console.warn(`skip ${route} (${res?.status()})`);
    continue;
  }
  const meta = await page.evaluate(shellInPage);
  const main = await page.evaluate(processInPage, { selector: 'main', route, keep: [] });
  pages.push({ route, title: meta.title, description: meta.description, html: main.html });
  for (const link of await page.evaluate(linksInPage)) {
    if (!seen.has(link) && !skip(link)) {
      seen.add(link);
      queue.push(link);
    }
  }
}

// The not-found page, captured from a path that cannot exist.
await page.goto(`${base}/__export_missing_page__`, { waitUntil: 'load' });
const missing = await page.evaluate(processInPage, { selector: 'main', route: '/__404', keep: [] });
const missingMeta = await page.evaluate(shellInPage);
pages.push({ route: '/__404', title: missingMeta.title, description: '', html: missing.html });

// Shared chrome from the home page.
await page.goto(base + '/', { waitUntil: 'load' });
const shell = await page.evaluate(shellInPage);
const headerHtml = (
  await page.evaluate(processInPage, { selector: 'header.site-header', route: '/', keep: [] })
).html;
const footerHtml = (
  await page.evaluate(processInPage, { selector: 'footer', route: '/', keep: [] })
).html;
const skipHtml = (
  await page.evaluate(processInPage, { selector: 'a[href="#main"]', route: '/', keep: ['#main'] })
).html;
const ribbon = await page.evaluate(processInPage, {
  selector: 'aside[aria-label="Preview notice"]',
  route: '/',
  keep: [],
});
await browser.close();

// ------------------------------------------------------------------ styles and fonts

const mime = (file) =>
  ({
    woff2: 'font/woff2',
    woff: 'font/woff',
    ttf: 'font/ttf',
    svg: 'image/svg+xml',
    png: 'image/png',
  })[file.split('.').pop()] ?? 'application/octet-stream';

let css = '';
for (const href of shell.stylesheets) {
  let text = await (await fetch(href)).text();
  const urls = [
    ...new Set([...text.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2])),
  ].filter((u) => !u.startsWith('data:'));
  for (const u of urls) {
    const abs = new URL(u, href).toString();
    const buf = Buffer.from(await (await fetch(abs)).arrayBuffer());
    text = text.split(u).join(`data:${mime(abs)};base64,${buf.toString('base64')}`);
  }
  css += text;
}
const runtimeCss = await readFile(path.join(here, 'runtime.css'), 'utf8');
const runtimeJs = await readFile(path.join(here, 'runtime.js'), 'utf8');

// ------------------------------------------------------------------ images

const allHtml = [headerHtml, footerHtml, ribbon?.html ?? '', ...pages.map((p) => p.html)].join(
  '\n',
);
const files = [...new Set([...allHtml.matchAll(/data-sa="([^"]+)"/g)].map((m) => m[1]))].sort();
const assets = {};
let imageBytes = 0;
for (const file of files) {
  const input = path.join(projectRoot, 'public/images/myron', file);
  const info = await sharp(input).metadata();
  const width = Math.min(info.width ?? 1280, (info.width ?? 0) >= 1800 ? 1600 : 1280);
  const buf = await sharp(input)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 68 })
    .toBuffer();
  imageBytes += buf.length;
  assets[file] = `data:image/webp;base64,${buf.toString('base64')}`;
}

// ------------------------------------------------------------------ metadata

const siteMetadata = await (await fetch(`${base}/site-metadata.json`)).json();
let commit = null;
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: projectRoot }).toString().trim();
} catch {
  // not a git checkout
}
const generatedAt = new Date().toISOString();
const home = pages.find((p) => p.route === '/');

const embedded = {
  ...siteMetadata,
  export: {
    format: 'Single-file HTML export of the site',
    generatedAt,
    commit,
    siteUrl,
    pages: pages
      .filter((p) => p.route !== '/__404')
      .map(({ route, title, description }) => ({ route, title, description })),
    notes: [
      'Preview build: concept imagery, draft copy and demo fixtures are labelled on the pages.',
      'Images are re-encoded WebP copies of the asset register files; see `assets` for rights status.',
      'Forms cannot send from a downloaded file and say so; the live site delivers to configured webhooks.',
    ],
  },
};

const identity = shell.jsonLd.map((s) => JSON.parse(s)).find((d) => d['@graph']) ?? null;
const personId = identity?.['@graph']?.find((n) => n['@type'] === 'Person')?.['@id'];
const books = siteMetadata.records.books
  .filter((b) => b.status === 'active' && !b.isDemo)
  .map((b) => ({
    '@type': 'Book',
    name: b.title,
    url: siteUrl + b.href,
    ...(personId ? { author: { '@id': personId } } : {}),
  }));
const jsonLd = identity ? { ...identity, '@graph': [...identity['@graph'], ...books] } : null;

const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const attr = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const isPreview = siteMetadata.mode !== 'production';
const icon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23111114'/%3E%3Cpath d='M32 11 53 32 32 53 11 32Z' fill='none' stroke='%23cba45d' stroke-width='2.5'/%3E%3Ctext x='32' y='39.5' text-anchor='middle' font-family='Georgia,serif' font-size='20' font-weight='600' fill='%23f8f5ee'%3EMG%3C/text%3E%3C/svg%3E";

const head = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${attr(home.title)}</title>
<meta name="description" content="${attr(home.description)}">
<meta name="application-name" content="${attr(siteMetadata.name)}">
<meta name="author" content="${attr(siteMetadata.legalEntity)}">
<meta name="generator" content="myron-golden-site single-file export${commit ? ` (${commit})` : ''}">
<meta name="date" content="${generatedAt}">
<meta name="robots" content="${isPreview ? 'noindex, nofollow' : 'index, follow'}">
<meta name="theme-color" content="#111114">
<meta name="color-scheme" content="dark">
<meta name="format-detection" content="telephone=no, email=no, address=no">
<link rel="canonical" href="${siteUrl}/">
<link rel="icon" type="image/svg+xml" href="${icon}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${attr(siteMetadata.name)}">
<meta property="og:title" content="${attr(home.title)}">
<meta property="og:description" content="${attr(home.description)}">
<meta property="og:url" content="${siteUrl}/">
<meta property="og:locale" content="en_US">
<meta property="og:image" content="${siteUrl}/og/og-default.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Myron Golden on a dark stage with warm gold lighting.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(home.title)}">
<meta name="twitter:description" content="${attr(home.description)}">
<meta name="twitter:image" content="${siteUrl}/og/og-default.jpg">`;

const html = `<!doctype html>
<!--
  ${siteMetadata.name} — single-file export of the website preview.
  Generated ${generatedAt}${commit ? ` from commit ${commit}` : ''}. Open in any modern browser; no server needed.
  Machine-readable metadata (sources, outstanding confirmations, image rights) is in #mg-site-metadata.
-->
<html lang="en" class="${attr(shell.htmlClass)}">
<head>
${head}
${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>` : ''}
<style>${css}</style>
<style>${runtimeCss}</style>
</head>
<body class="${attr(shell.bodyClass)}">
<div id="site-shell" class="${attr(shell.shellClass)}">
${skipHtml}
${headerHtml}
<main id="main" tabindex="-1" class="${attr(shell.mainClass)}"></main>
${footerHtml}
</div>
${ribbon?.html ?? ''}
<noscript><p style="padding:1rem;background:#cba45d;color:#111114">This file needs JavaScript to show its pages.</p></noscript>
${pages
  .map(
    (p) =>
      `<template data-route="${attr(p.route)}" data-title="${attr(p.title)}" data-description="${attr(p.description)}">${p.html}</template>`,
  )
  .join('\n')}
<script type="application/json" id="mg-site-metadata">${safeJson(embedded)}</script>
<script type="application/json" id="mg-assets">${safeJson(assets)}</script>
<script>${runtimeJs}</script>
</body>
</html>
`;

await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, html);
stopServer();

const mb = (n) => (n / 1048576).toFixed(1);
console.log(
  `Wrote ${path.relative(projectRoot, out)}: ${mb(Buffer.byteLength(html))} MB, ${pages.length - 1} pages + 404, ${files.length} images (${mb(imageBytes)} MB before base64).`,
);
process.exit(0);
