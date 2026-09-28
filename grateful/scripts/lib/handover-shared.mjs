/** Pieces shared by the handover builds (build-handover.mjs, build-whatsapp.mjs). */
import { readFileSync } from 'node:fs';

export const dir = new URL('../../preview/', import.meta.url);
export const read = (f) => readFileSync(new URL(f, dir), 'utf8');
export const font = (pkg, file) => readFileSync(new URL(`../../node_modules/@fontsource-variable/${pkg}/files/${file}`, import.meta.url)).toString('base64');

export const PREVIEW_URL = 'https://claude.ai/artifact/UxjQRoLaGToJwxH5sEnHKN';
export const CHECKLIST_URL = 'https://claude.ai/artifact/8Min81Y6Tcq4Tg2XbQ3eN6';

/** Prefix every selector in a stylesheet with `scope`, so a page's styles only reach its own section. */
export function scopeCss(css, scope) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '';
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const head = css.slice(i, open).trim();
    // Find the matching close brace (blocks nest one level, in @media).
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (head.startsWith('@media') || head.startsWith('@supports')) out += `${head}{${scopeCss(body, scope)}}`;
    else if (head.startsWith('@')) out += `${head}{${body}}`;
    else {
      const sel = head
        .split(',')
        .map((s) => s.trim())
        .map((s) => {
          if (s === 'body' || s === 'html' || s === ':root') return scope;
          if (s.startsWith(':root')) return `${s} ${scope}`;
          return `${scope} ${s}`;
        })
        .join(', ');
      out += `${sel}{${body}}`;
    }
    i = j;
  }
  return out;
}

/** The styles and the visible page (the .wrap block) of one of the report pages. */
export function page(file, scope) {
  const html = read(file);
  const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const start = html.indexOf('<div class="wrap">');
  const end = html.lastIndexOf('</div>');
  if (start === -1 || end === -1) throw new Error(`${file}: no .wrap block found`);
  return { css: scopeCss(style, scope), body: html.slice(start, end + 6) };
}

export const b64 = (path) => readFileSync(new URL(path, import.meta.url)).toString('base64');
export const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The photographs, with the alt text from the image catalogue (read as text: the module needs Vite).
export const catalogue = readFileSync(new URL('../../src/data/images.ts', import.meta.url), 'utf8');
export const photos = [...catalogue.matchAll(/(\w+): \{\s*src: `\$\{base\}images\/([^`]+)`,\s*alt: '([^']+)'/g)].map(([, key, file, alt]) => ({
  key,
  alt,
  src: `data:image/webp;base64,${b64(`../../public/images/${file}-640.webp`)}`,
}));
export const photoCaption = { burgundyGown: 'Burgundy satin gown · home page, Garment Study 01', greenGown: 'Emerald gown · Garment Study 02, Custom Fashion Design', navyDress: 'Navy bow dress · Garment Study 03', whiteShirtLook: 'White shirt look · Philosophy, Home and About', burgundyDetail: 'Burgundy dress on the form · Fittings, Special Occasion' };

export const icon = `data:image/svg+xml,${encodeURIComponent(readFileSync(new URL('../../public/favicon.svg', import.meta.url), 'utf8'))}`;
export const touchIcon = `data:image/png;base64,${b64('../../public/apple-touch-icon.png')}`;
export const DESCRIPTION = 'The Grateful website (a fashion design studio in Mulbarton, Johannesburg), with its completion audit and costing, in one file.';


/** The embedded fonts, so nothing is fetched from the internet. */
export const fontFaces = `@font-face { font-family: 'Baskervville'; font-style: normal; font-weight: 400 700; font-display: swap; src: url(data:font/woff2;base64,${font('baskervville', 'baskervville-latin-wght-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'Baskervville'; font-style: italic; font-weight: 400 700; font-display: swap; src: url(data:font/woff2;base64,${font('baskervville', 'baskervville-latin-wght-italic.woff2')}) format('woff2'); }
@font-face { font-family: 'Inter'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(data:font/woff2;base64,${font('inter', 'inter-latin-wght-normal.woff2')}) format('woff2'); }`;
