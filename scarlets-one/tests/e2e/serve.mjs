// A tiny static server for the exported web build, with the single-page
// fallback a real host would be configured with: any unknown path serves
// index.html so a deep link opens the right screen.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
};

export function serve(root, port = 0) {
  const base = resolve(root);
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    let file = normalize(join(base, path));
    if (!file.startsWith(base)) {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(base, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address();
      done({ url: `http://127.0.0.1:${actual}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

// Run directly: node tests/e2e/serve.mjs <dir> [port]
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { url } = await serve(
    process.argv[2] ?? 'apps/mobile/dist',
    Number(process.argv[3] ?? 4173),
  );
  console.log(`Serving ${process.argv[2] ?? 'apps/mobile/dist'} at ${url}`);
}
