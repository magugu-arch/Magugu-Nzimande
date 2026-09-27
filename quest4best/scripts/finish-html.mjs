// Final pass for the single-file build:
// - writes the server-rendered page into the file, so it reads correctly even
//   where JavaScript does not run (Android file previews, mail and chat apps);
// - makes the favicon a data URI and drops links that only work on a server.
// The result opens with a double-click on a Mac or a tap on Android.
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

const leftovers = html.match(/(?:src|srcset|href)="\.?\/?assets\/[^"]*"/gi);
if (leftovers) throw new Error(`Unembedded assets: ${leftovers.join(', ')}`);

writeFileSync(file, html);
rmSync(ssrDir, { recursive: true, force: true });
console.log(`${file}: ${(statSync(file).size / 1024 / 1024).toFixed(2)} MB`);
