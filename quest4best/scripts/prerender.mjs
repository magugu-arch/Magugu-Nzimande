// Writes the server-rendered page into the built index.html (and 404.html),
// then removes the temporary server bundle.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ssrEntry = resolve('dist-ssr/entry-server.js');
const { render } = await import(pathToFileURL(ssrEntry).href);
const markup = render();

for (const page of ['dist/index.html', 'dist/404.html']) {
  const html = readFileSync(page, 'utf8');
  if (!html.includes('<div id="root"></div>')) throw new Error(`No empty root in ${page}`);
  writeFileSync(page, html.replace('<div id="root"></div>', `<div id="root">${markup}</div>`));
}
rmSync('dist-ssr', { recursive: true, force: true });
console.log(`Pre-rendered ${(markup.length / 1024).toFixed(1)} kB of HTML`);
