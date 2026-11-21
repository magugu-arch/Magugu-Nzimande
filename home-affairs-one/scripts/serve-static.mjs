#!/usr/bin/env node
/**
 * Minimal static file server for the exported site.
 *   node scripts/serve-static.mjs <dir> <port> [basePath]
 * Serves `<dir>` at `/` (or under `basePath`), resolving folders to index.html
 * the way a static host does, and falling back to 404.html.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const [dirArg = 'apps/web/out', portArg = '4173', baseArg = ''] = process.argv.slice(2);
const root = path.resolve(dirArg);
const port = Number(portArg);
const base = baseArg.replace(/\/$/, '');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function resolveFile(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (base) {
    if (!rel.startsWith(base)) return null;
    rel = rel.slice(base.length) || '/';
  }
  const target = path.join(root, rel);
  if (!target.startsWith(root)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  const index = path.join(target, 'index.html');
  if (existsSync(index)) return index;
  if (existsSync(`${target}.html`)) return `${target}.html`;
  return null;
}

http
  .createServer((req, res) => {
    const file = resolveFile(req.url ?? '/');
    if (!file) {
      const notFound = path.join(root, '404.html');
      res.writeHead(404, { 'content-type': TYPES['.html'] });
      if (existsSync(notFound)) createReadStream(notFound).pipe(res);
      else res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    createReadStream(file).pipe(res);
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`Serving ${root} at http://127.0.0.1:${port}${base}/`);
  });
