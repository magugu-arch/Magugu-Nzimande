// Final pass for the single-file build:
// - writes the server-rendered page into the file, so it reads correctly even
//   where JavaScript does not run (Android file previews, mail and chat apps);
// - makes the favicon a data URI and drops links that only work on a server.
// The result opens with a double-click on a Mac or a tap on Android.
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const file = 'dist-html/index.html';
const ssrDir = 'dist-ssr-html';
const { render } = await import(pathToFileURL(resolve(ssrDir, 'entry-server.js')).href);
const favicon = readFileSync('public/favicon-32.png').toString('base64');

let html = readFileSync(file, 'utf8');
if (!html.includes('<div id="root"></div>')) throw new Error('No empty root to fill');
html = html
  .replace('<div id="root"></div>', `<div id="root">${render()}</div>`)
  .replace(/\s*<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g, '')
  .replace(
    '</title>',
    `</title>\n    <link rel="icon" type="image/png" href="data:image/png;base64,${favicon}" />`,
  );

// Content Security Policy: the only script and styles allowed to run are the
// exact ones built into this file, identified by their SHA-256 hashes.
const sha = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
const scripts = [...html.matchAll(/<script type="module"[^>]*>([\s\S]*?)<\/script>/g)].map((m) =>
  sha(m[1]),
);
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => sha(m[1]));
if (!scripts.length || !styles.length)
  throw new Error('Expected an inline script and style to hash');
let formOrigin = '';
try {
  const endpoint = process.env.VITE_FORM_ENDPOINT ?? '';
  if (/^https:\/\//.test(endpoint)) formOrigin = new URL(endpoint).origin;
} catch {
  formOrigin = '';
}
const csp = [
  "default-src 'none'",
  `script-src ${scripts.join(' ')}`,
  `style-src ${styles.join(' ')}`,
  'img-src data:',
  'font-src data:',
  `connect-src ${formOrigin || "'none'"}`,
  `form-action mailto:${formOrigin ? ` ${formOrigin}` : ''}`,
  "base-uri 'none'",
  "object-src 'none'",
].join('; ');
html = html.replace(
  /<meta charset="UTF-8" \/>/i,
  (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
);
if (!html.includes('Content-Security-Policy')) throw new Error('CSP was not inserted');

const leftovers = html.match(/(?:src|srcset|href)="\.?\/?assets\/[^"]*"/gi);
if (leftovers) throw new Error(`Unembedded assets: ${leftovers.join(', ')}`);

writeFileSync(file, html);
rmSync(ssrDir, { recursive: true, force: true });
console.log(`${file}: ${(statSync(file).size / 1024 / 1024).toFixed(2)} MB`);
