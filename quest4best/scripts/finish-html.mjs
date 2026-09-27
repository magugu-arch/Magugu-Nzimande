// Final pass for the single-file build: the favicon becomes a data URI and the
// links that only make sense on a web server (manifest, touch icon, .ico) go,
// so the one file opens cleanly from disk or an email attachment.
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const file = 'dist-html/index.html';
const favicon = readFileSync('public/favicon-32.png').toString('base64');

const html = readFileSync(file, 'utf8')
  .replace(/\s*<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g, '')
  .replace(
    '</title>',
    `</title>\n    <link rel="icon" type="image/png" href="data:image/png;base64,${favicon}" />`,
  );

writeFileSync(file, html);
const leftovers = html.match(/(?:src|href)="\.?\/?assets\/[^"]*"/g);
if (leftovers) throw new Error(`Unembedded assets: ${leftovers.join(', ')}`);
console.log(`${file}: ${(statSync(file).size / 1024 / 1024).toFixed(2)} MB`);
