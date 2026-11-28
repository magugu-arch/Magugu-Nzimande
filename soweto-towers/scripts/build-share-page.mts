/**
 * One self-contained HTML page about Soweto Towers, for sharing on WhatsApp
 * and opening on any phone, with no internet connection needed.
 *
 *   npm run share:page            (writes share/Soweto-Towers.html)
 *   npx tsx scripts/build-share-page.mts [out.html]
 *
 * - Everything is inside the one file: photos (WebP), the Archivo font, the
 *   S + T logo (identity option 01), the favicon and touch icon. Nothing is
 *   fetched from the network.
 * - Set for reading on a phone: Archivo, the identity's typeface, at 450 for
 *   text and 700 for headings, a 17px base that follows the reader's text
 *   size on iPhone, body text at 7:1 contrast or better and no text
 *   below 4.5:1.
 * - Parallax from CSS alone (scroll-driven animations): photos drift more
 *   slowly than the page inside their frames, and on phones the opening
 *   photo holds still while the panel slides up over it. Text never moves
 *   apart from the finger. Off with Reduce Motion; browsers without
 *   scroll-driven animations show still photos.
 * - Works with scripts off. WhatsApp's document viewer on iPhone (Quick Look)
 *   and some Android viewers switch them off, so every part works without:
 *   in-page links, native <details> for questions, CSS-only scrolling rails,
 *   and the menu beside Book (a checkbox drawn as a button, so it opens in
 *   any viewer; it grows from its button on a spring curve).
 * - One small optional script: where scripts run, in-page links scroll to
 *   their section without following the "#" link (app previewers that show
 *   the file in a frame break "#" links), and the menu closes when a section
 *   is chosen or Escape is pressed.
 * - Metadata for search and link previews (title, description, Open Graph,
 *   Twitter, geo tags, JSON-LD) points at the live site, so the same file can
 *   also be hosted as-is.
 * - All facts, prices, rules and hours come from the website's own content
 *   modules, so the page always matches the site. Re-run after changing them.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { stAppIconSvg, stColors, stLockupSvg, stMarkSvg, stStackedSvg } from '../src/components/brand/st-identity';
import { activities, addons, medicalExclusions, packages, type Activity } from '../src/content/catalog';
import { faqs } from '../src/content/faq';
import { image, type ImageSlug } from '../src/content/images';
import { menu } from '../src/content/menu';
import { directions, site, whatsappLink } from '../src/content/site';
import { rand } from '../src/lib/format';
import { weeklyHoursSummary } from '../src/lib/hours';
import { sunsetHm } from '../src/lib/sun';
import { formatDate, ymdInSast } from '../src/lib/time';

const SITE = 'https://sowetotowers.co.za';
const root = path.resolve(import.meta.dirname, '..');
const outFile = path.resolve(process.argv[2] ?? path.join(root, 'share', 'Soweto-Towers.html'));

// ---------------------------------------------------------------- helpers

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const wa = (text: string) => esc(whatsappLink(text));
const year = ymdInSast(new Date()).slice(0, 4);

type Embedded = { src: string; width: number; height: number; alt: string; bytes: number };
let imageBytes = 0;

/** A photo cropped to `aspect` around its focal point, resized and inlined as WebP. */
async function photo(slug: ImageSlug, width: number, aspect: number, quality = 58, focus?: string): Promise<Embedded> {
  const info = image(slug);
  const [fx, fy] = (focus ?? info.focus).split(' ').map((v) => parseFloat(v) / 100) as [number, number];
  let cw = info.width;
  let ch = Math.round(cw / aspect);
  if (ch > info.height) {
    ch = info.height;
    cw = Math.round(ch * aspect);
  }
  const left = Math.round((info.width - cw) * fx);
  const top = Math.round((info.height - ch) * fy);
  const buf = await sharp(path.join(root, 'public', 'images', `${slug}.jpg`))
    .extract({ left, top, width: cw, height: ch })
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 6, smartSubsample: true })
    .toBuffer();
  const meta = await sharp(buf).metadata();
  imageBytes += buf.length;
  return { src: `data:image/webp;base64,${buf.toString('base64')}`, width: meta.width ?? width, height: meta.height ?? 0, alt: info.alt, bytes: buf.length };
}

// No loading="lazy": the bytes are already in the file, so lazy loading saves
// nothing, and some phone previewers never load images that start off-screen.
const img = (p: Embedded, opts: { className?: string; eager?: boolean } = {}) =>
  `<img src="${p.src}" width="${p.width}" height="${p.height}" alt="${esc(p.alt)}"${opts.className ? ` class="${opts.className}"` : ''} decoding="async"${opts.eager ? ' fetchpriority="high"' : ''}>`;

/** Ends a phrase with one full stop, whatever it ended with before. */
const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

// Small line icons (decorative: always next to text).
const icon = {
  whatsapp:
    '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12.04 2.5a9.43 9.43 0 0 0-8.1 14.27L2.5 21.5l4.86-1.4A9.44 9.44 0 1 0 12.04 2.5Zm0 17.1a7.66 7.66 0 0 1-3.9-1.07l-.28-.17-2.88.83.84-2.8-.19-.29a7.67 7.67 0 1 1 6.41 3.5Zm4.2-5.74c-.23-.12-1.36-.67-1.57-.75-.21-.08-.36-.12-.52.12-.15.23-.6.75-.73.9-.14.15-.27.17-.5.06a6.3 6.3 0 0 1-3.13-2.74c-.24-.4.24-.38.68-1.26.08-.15.04-.29-.02-.4-.06-.12-.52-1.25-.71-1.71-.19-.45-.38-.39-.52-.4h-.44a.85.85 0 0 0-.62.29 2.6 2.6 0 0 0-.81 1.93 4.5 4.5 0 0 0 .95 2.4 10.3 10.3 0 0 0 3.95 3.49c1.47.63 2.04.69 2.78.58.45-.07 1.36-.56 1.55-1.1.2-.54.2-1 .14-1.1-.06-.1-.21-.16-.44-.27Z"/></svg>',
  phone:
    '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16.5v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.5 5.2 2 2 0 0 1 5.5 3h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L9.5 10.7a16 16 0 0 0 3.8 3.8l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>',
  mail: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>',
  pin: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  check:
    '<svg class="i i--check" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 10.5 3 3 7-7"/></svg>',
  arrow:
    '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

// The menu button's two bars (they turn into an X in CSS).
const bars = '<span class="bars" aria-hidden="true"><span></span><span></span></span>';

// Optional. Everything works without it. Where scripts run, in-page links
// scroll to their section without following the "#" link, which also makes
// them work in app previewers whose frames break "#" links, and choosing a
// section or pressing Escape closes the menu. Once the page has a #target
// (a "#" link has already worked natively), links are left to the browser.
const enhance = `(() => {
  const toggle = document.getElementById('menu-toggle');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (document.querySelector(':target')) return;
    const section = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (!section) return;
    e.preventDefault();
    toggle.checked = false;
    section.scrollIntoView({ behavior: still.matches ? 'auto' : 'smooth', block: 'start' });
    if (!section.hasAttribute('tabindex')) section.setAttribute('tabindex', '-1');
    section.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.checked) { toggle.checked = false; toggle.focus(); }
    if (e.key === 'Enter' && e.target === toggle) { e.preventDefault(); toggle.click(); }
  });
})();`;

// -------------------------------------------------------------- assets

const font = (await readFile(path.join(root, 'src', 'fonts', 'archivo-latin-wght-normal.woff2'))).toString('base64');

// Identity option 01, the S + T monogram, drawn from the identity document's own artwork.
const headerLockup = stLockupSvg({ height: 40 });
const footerLockup = stStackedSvg({ width: 232, s: stColors.bone, t: stColors.crimson, text: stColors.bone, descriptor: true });
// The large, quiet monogram behind the footer, as on the identity's website page.
const watermark = stMarkSvg({ size: 300, s: '#262420', t: '#262420' }).replace('<svg ', '<svg class="watermark" ');
const faviconSvg = `data:image/svg+xml;base64,${Buffer.from(stAppIconSvg({ size: 64 })).toString('base64')}`;
// Square: iOS rounds the corners of a home-screen icon itself.
const touchIcon = `data:image/png;base64,${(
  await sharp(Buffer.from(stAppIconSvg({ size: 180, radius: 0 })))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer()
).toString('base64')}`;

const heroTall = await photo('bungee-between-towers', 860, 4 / 5, 56, '50% 55%');
const heroWide = await photo('towers-mural-hero', 1600, 16 / 9, 56);
const cards = new Map<string, Embedded>();
for (const a of activities) cards.set(a.id, await photo(a.cardImage ?? a.image, 720, 4 / 3, 54));
const scream = await photo('scream-clip-phone', 640, 4 / 5, 56);
const safety = await photo('harness-check', 640, 4 / 5, 56, '60% 55%');
const groups = await photo('team-day', 1100, 16 / 10, 56, '55% 40%');
const gift = await photo('gift-a-jump', 640, 4 / 5, 56);
const food = await photo('shisanyama-platter', 960, 3 / 2, 56);
const visit = await photo('soweto-street-tour', 1100, 16 / 9, 56, '60% 40%');
const contact = await photo('towers-twilight-reflection', 1400, 16 / 9, 50);

// -------------------------------------------------------------- content

const BOOK_TEXT = 'Hi Soweto Towers! I would like to book.\nActivity: \nDate: \nNumber of people: ';
const bookText = (what: string) => `Hi Soweto Towers! I would like to book ${what}.\nDate: \nNumber of people: `;

function priceNote(a: Activity): string {
  if (a.booking.mode === 'session') return `per player · ${a.booking.minGroup}–${a.booking.maxGroup} players · 1-hour game`;
  if (a.booking.mode === 'enquiry') return 'per jump · by arrangement';
  return a.group ? `per person · ${rand(a.group.price)} each for ${a.group.min}+` : 'per person';
}

const adventureCards = activities
  .map((a) => {
    const facts = a.facts.filter((f) => f.label !== 'Price' && !f.label.startsWith('Groups'));
    const enquiry = a.booking.mode === 'enquiry';
    const cta = enquiry
      ? `<a class="link" href="${wa('Hi Soweto Towers! I am a skydiver and would like to base jump from the towers.\nNumber of freefalls: \nPreferred date: ')}">${icon.whatsapp}Apply on WhatsApp</a>`
      : `<a class="link" href="${wa(bookText(`the ${a.name}`))}">${icon.whatsapp}Book on WhatsApp</a>`;
    return `<li class="card">
  <div class="card__media">${img(cards.get(a.id)!)}${a.badge ? `<span class="badge">${esc(a.badge)}</span>` : ''}</div>
  <div class="card__body">
    <h3>${esc(a.name)}</h3>
    <p class="muted">${esc(sentence(a.short))}</p>
    <ul class="facts" aria-label="Key facts">${facts.map((f) => `<li><span>${esc(f.label)}</span> ${esc(f.value)}</li>`).join('')}</ul>
    <p class="price">${rand(a.price)}<small>${esc(priceNote(a))}</small></p>
    ${cta}
  </div>
</li>`;
  })
  .join('\n');

const ctaCards = [
  {
    title: 'Coming as a group?',
    body: `Groups of ${activities.find((a) => a.id === 'bungee-jump')!.group!.min} or more save on the bungee and the SCAD freefall. Team days, birthdays and schools.`,
    cta: 'Plan a group day',
    href: wa('Hi Soweto Towers! I would like to plan a group day.\nGroup size: \nDate: \nOccasion: '),
    tone: 'dark',
  },
  {
    title: 'Gift a Jump',
    body: 'A voucher for any adventure, bundle or amount, valid for 365 days. Sent by WhatsApp or email.',
    cta: 'Order a voucher',
    href: wa('Hi Soweto Towers! I would like to buy a Gift a Jump voucher.\nFor: \nAdventure or amount: \nSend it on: '),
    tone: 'crimson',
  },
]
  .map(
    (c) => `<li class="card card--cta card--${c.tone}">
  <div class="card__body">
    <h3>${esc(c.title)}</h3>
    <p>${esc(c.body)}</p>
    <a class="btn ${c.tone === 'dark' ? 'btn--primary' : 'btn--ink'}" href="${c.href}">${icon.whatsapp}${esc(c.cta)}</a>
  </div>
</li>`,
  )
  .join('\n');

const bundleCards = packages
  .map(
    (p) => `<li class="bundle${p.recommended ? ' bundle--pick' : ''}">
  ${p.recommended ? '<p class="tag">Recommended</p>' : ''}
  <h3>${esc(p.name)}</h3>
  <p class="price price--big">${rand(p.price)}<small>per person${p.saving ? ` · save ${rand(p.saving)}` : ''}</small></p>
  <ul class="ticks">${p.includes.map((i) => `<li>${icon.check}${esc(i)}</li>`).join('')}</ul>
  <a class="btn ${p.recommended ? 'btn--primary' : 'btn--ink'} btn--block" href="${wa(bookText(`the ${p.name} bundle`))}">${icon.whatsapp}Book ${esc(p.name)}</a>
</li>`,
  )
  .join('\n');

const bungee = activities.find((a) => a.id === 'bungee-jump')!;
const scad = activities.find((a) => a.id === 'scad-freefall')!;
const lift = activities.find((a) => a.id === 'lift-ride')!;
const lowest = Math.min(...activities.map((a) => a.price));

// Questions as on the site, minus two references to site-only features.
const faqPicks = [6, 2, 5, 11, 9, 3, 7, 15, 14, 12, 17, 4]
  .map((i) => faqs[i]!)
  .map((f) => ({ q: f.q, a: f.a.replace(/ The status strip at the top of every page[^.]*\./, '').replace(' on the Groups page', ' on WhatsApp') }));

const hours = weeklyHoursSummary();
const summerSunset = sunsetHm(`${year}-12-21`);
const winterSunset = sunsetHm(`${Number(year) + 1}-06-21`);

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE}/#organization`,
      name: site.name,
      alternateName: site.alternateNames,
      url: SITE,
      logo: `${SITE}/icons/icon-512.png`,
      email: site.email,
      telephone: site.phone.e164,
      sameAs: [site.socials.facebook, site.socials.youtube].filter(Boolean),
    },
    {
      '@type': ['TouristAttraction', 'SportsActivityLocation'],
      '@id': `${SITE}/#attraction`,
      name: site.name,
      alternateName: site.alternateNames,
      description: `Bungee jumping, SCAD freefall, a zipline, paintball and a lift ride on the painted cooling towers of the former Orlando Power Station. Open Thursday to Sunday until sunset.`,
      url: SITE,
      image: `${SITE}/og/home.jpg`,
      telephone: site.phone.e164,
      email: site.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: site.address.street,
        addressLocality: `${site.address.suburb}, ${site.address.city}`,
        addressRegion: site.address.region,
        addressCountry: site.address.country,
      },
      geo: { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng },
      openingHoursSpecification: Object.entries(site.weeklyOpening)
        .filter(([, opens]) => opens)
        .map(([d, opens]) => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: `https://schema.org/${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(d)]}`,
          opens,
        })),
      isAccessibleForFree: false,
      publicAccess: true,
      currenciesAccepted: 'ZAR',
      paymentAccepted: 'Credit card, debit card',
      priceRange: `${rand(lowest)}–${rand(Math.max(...activities.map((a) => a.price), ...packages.map((p) => p.price)))}`,
      makesOffer: activities.map((a) => ({
        '@type': 'Offer',
        name: a.name,
        description: a.short,
        price: a.price,
        priceCurrency: 'ZAR',
        url: `${SITE}/adventures/${a.id}`,
      })),
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqPicks.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ],
};

const title = 'Soweto Towers (Orlando Towers) · Bungee, SCAD Freefall & Zipline in Soweto';
const description = `Bungee jump 100m between the painted Soweto Towers (Orlando Towers), freefall inside the tower, ride the zipline over the Orlando Dam or take in the 360° view. Prices, hours, safety and booking on WhatsApp.`;

// ---------------------------------------------------------------- styles

// A critically damped spring (it settles without overshoot) as a CSS easing:
// x(t) = 1 − (1 + ωt)·e^(−ωt), with ω = 2π / 0.4 s, sampled over the 0.5 s the
// menu's transitions run for. Browsers without linear() get a close bezier.
const SPRING_S = 0.5;

// When the menu is open: the checkbox is ticked and the page has no #target
// yet, or #menu is the target (links mode, after a section link has worked).
const MENU_OPEN_BODY = ':is(body:not(:has(:target)):has(#menu-toggle:checked), body:has(#menu:target))';
const MENU_OPEN = `${MENU_OPEN_BODY} .sheet`;
const spring = (() => {
  const w = (2 * Math.PI) / 0.4;
  const steps = 24;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * SPRING_S;
    return i === steps ? 1 : 1 - (1 + w * t) * Math.exp(-w * t);
  });
  return `linear(${points.map((p) => +p.toFixed(4)).join(', ')})`;
})();

const css = /* css */ `
@font-face { font-family: "Archivo"; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 100 900; font-style: normal; font-display: swap; }
:root {
  --bone: ${stColors.bone}; --paper: ${stColors.paper}; --sand: #ECE5D8; --chip: #EFE9DF;
  --black: ${stColors.towerBlack}; --ink: ${stColors.towerBlack}; --ink-2: ${stColors.ink};
  --on-dark: ${stColors.bone}; --on-dark-2: #CBC4B8;
  --crimson: ${stColors.crimson}; --crimson-lo: #A60D26; --crimson-soft: #F47C8C;
  --line: rgb(21 20 18 / .13); --line-dark: rgb(243 239 231 / .16);
  --r-xl: 28px; --r-lg: 22px; --r-md: 16px; --gutter: clamp(16px, 4vw, 40px); --max: 1200px;
  --font: "Archivo", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --spring: cubic-bezier(.25, 1, .4, 1); --spring-s: ${SPRING_S}s;
  color-scheme: light;
}
@supports (transition-timing-function: linear(0, 1)) { :root { --spring: ${spring}; } }
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; scroll-behavior: smooth; }
/* In-page links land each section right under the header, and keyboard focus
   never hides beneath it. This is scroll-margin on the page's own targets, not
   scroll-padding on html: with scroll-padding, Chrome scrolls the page even for
   the menu's fixed-position targets, so opening the menu would jump. */
#main, :is(main, footer) :is([id], a, button, summary, [tabindex]) { scroll-margin-top: calc(64px + env(safe-area-inset-top)); }
/* iPhone and iPad: start from the reader's own text size (Dynamic Type). Not on a Mac, where it would make the text smaller. */
@supports (font: -apple-system-body) and (-webkit-touch-callout: none) { html { font: -apple-system-body; } }
body { margin: 0; font-family: var(--font); font-size: 1.0625rem; font-weight: 450; line-height: 1.6; color: var(--ink); background: var(--bone); }
img { display: block; max-width: 100%; height: auto; }
a { color: inherit; }
p, ul, ol, dl, dd, figure { margin: 0; }
ul, ol { padding: 0; list-style: none; }
b, strong, dt { font-weight: 700; }
h1, h2, h3 { margin: 0; font-weight: 700; text-wrap: balance; }
h1 { font-size: clamp(2.5rem, 10.5vw, 4.75rem); line-height: 1.02; letter-spacing: -.034em; }
h2 { font-size: clamp(2rem, 7.4vw, 3.4rem); line-height: 1.05; letter-spacing: -.03em; }
h3 { font-size: 1.3125rem; font-weight: 650; line-height: 1.2; letter-spacing: -.012em; }
/* Labels: tracked capitals after a crimson stroke, the T's drop, as tall as the label. */
.eyebrow { display: flex; align-items: center; gap: 10px; font-size: .875rem; font-weight: 700; line-height: 1.3; letter-spacing: .12em; text-transform: uppercase; color: var(--ink); }
.eyebrow::before { content: ""; flex: none; align-self: stretch; width: 4px; min-height: 1em; margin-block: .12em; border-radius: 4px; background: var(--crimson); }
.lede { font-size: 1.1875rem; line-height: 1.5; color: var(--ink-2); max-width: 46ch; text-wrap: pretty; }
.muted { color: var(--ink-2); }
.small { font-size: .9375rem; }
.i { width: 1.25em; height: 1.25em; flex: none; }
.wrap { width: min(100% - 2 * var(--gutter), var(--max)); margin-inline: auto; }
section { padding-block: clamp(56px, 10vw, 112px); }
.head { display: grid; gap: 16px; margin-bottom: clamp(24px, 4vw, 40px); max-width: 780px; }
.dark { background: var(--black); color: var(--on-dark); }
.dark .eyebrow { color: var(--on-dark); }
.dark .lede, .dark .muted { color: var(--on-dark-2); }
.tint { background: var(--sand); }

/* Skip link and focus */
.skip { position: absolute; left: 12px; top: -80px; z-index: 50; padding: 12px 16px; border-radius: 12px; background: var(--black); color: var(--on-dark); font-weight: 650; text-decoration: none; }
.skip:focus { top: calc(12px + env(safe-area-inset-top)); }
:focus-visible { outline: 3px solid var(--crimson); outline-offset: 3px; }
.dark :focus-visible, .band :focus-visible, footer :focus-visible, .hero__panel :focus-visible, .card--dark :focus-visible, .bundle--pick :focus-visible { outline-color: var(--on-dark); }
.card--crimson :focus-visible { outline-color: var(--black); }

/* Header: a translucent bar the page scrolls under */
.bar { position: sticky; top: 0; z-index: 20; padding-top: env(safe-area-inset-top); background: rgb(243 239 231 / .82); -webkit-backdrop-filter: saturate(180%) blur(18px); backdrop-filter: saturate(180%) blur(18px); box-shadow: 0 1px 0 var(--line); }
.bar__in { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 64px; }
.brand { display: inline-flex; align-items: center; min-height: 44px; color: var(--ink); text-decoration: none; }
.brand svg { display: block; flex: none; }
.bar__end { display: flex; align-items: center; gap: 8px; }
/* 320px phones: logo, Book and the menu button fit with slightly tighter spacing. */
@media (max-width: 359px) { .bar__in { gap: 8px; } .bar__end { gap: 6px; } .bar__end .btn { padding-inline: 14px; } }
.vh { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }

/* Menu. It has to work where scripts don't run (WhatsApp's iPhone viewer) and
   where "#" links don't (app previewers show the file in a frame, where
   "#menu" points at the previewer's own page and replaces this one). So the
   button is a real checkbox, drawn as a round button: tapping it never follows
   a link. Choosing a section closes the panel: where scripts run, the few
   lines at the end of the page do it; without scripts, the section link sets
   :target, and once the page has a target the button switches to links
   (#menu, #menu-closed) that close the panel on every choice. The panel and
   those targets are position: fixed, so opening and closing never scroll. */
.toggle { position: relative; flex: none; width: 44px; height: 44px; }
.toggle__state { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; margin: 0; border-radius: 50%; opacity: 0; cursor: pointer; -webkit-appearance: none; appearance: none; -webkit-tap-highlight-color: transparent; }
.toggle__face, .toggle a { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 50%; color: var(--ink); background: rgb(21 20 18 / .06); box-shadow: inset 0 0 0 1px var(--line); -webkit-tap-highlight-color: transparent; transition: opacity .2s ease, transform .12s ease-out, background-color .2s, visibility 0s; }
.toggle__state:hover + .toggle__face, .toggle a:hover { background: rgb(21 20 18 / .1); }
.toggle__state:active + .toggle__face, .toggle a:active { transform: scale(.92); }
.toggle__state:focus-visible + .toggle__face { outline: 3px solid var(--crimson); outline-offset: 3px; }
/* Links mode, once the page has a #target (so "#" links work in this viewer). */
.toggle a, body:has(#menu:target) .toggle__open { visibility: hidden; opacity: 0; transition: opacity .2s ease, visibility 0s linear .2s; }
body:has(:target) .toggle__state, body:has(:target) .toggle__face { display: none; }
body:has(:target):not(:has(#menu:target)) .toggle__open, body:has(#menu:target) .toggle__close { visibility: visible; opacity: 1; transition: opacity .2s ease, visibility 0s; }
/* Two bars that turn into an X. In links mode both links draw them, so the cross-fade reads as one icon changing. */
.bars { position: relative; width: 18px; height: 12px; }
.bars span { position: absolute; left: 0; right: 0; height: 2px; border-radius: 2px; background: currentColor; transition: transform var(--spring-s) var(--spring); }
.bars span:first-child { top: 2px; }
.bars span:last-child { bottom: 2px; }
${MENU_OPEN_BODY} .bars span:first-child { transform: translateY(3px) rotate(45deg); }
${MENU_OPEN_BODY} .bars span:last-child { transform: translateY(-3px) rotate(-45deg); }

.sheet { position: fixed; inset: calc(64px + env(safe-area-inset-top)) 0 0; z-index: 19; visibility: hidden; transition: visibility 0s linear var(--spring-s); }
${MENU_OPEN} { visibility: visible; transition: visibility 0s; }
.sheet:focus { outline: none; }
.sheet__scrim { position: absolute; inset: 0; background: rgb(21 20 18 / .2); opacity: 0; transition: opacity .3s ease; -webkit-tap-highlight-color: transparent; }
${MENU_OPEN} .sheet__scrim { opacity: 1; }
/* A tap outside closes it: the checkbox's label without a target, a link to #menu-closed with one. */
body:has(:target) .sheet__scrim--box, body:not(:has(:target)) .sheet__scrim--link { display: none; }
/* Where scripts move focus to the chosen section, the section itself shows no ring. */
#main:focus, main section:focus { outline: none; }
/* Lined up with the header's right edge, and grown from the menu button (its centre is 22px in from the right, 40px above the panel). */
.sheet__card { position: absolute; top: 8px; right: max(var(--gutter), (100% - var(--max)) / 2); width: min(360px, 100% - 2 * var(--gutter)); max-height: calc(100% - 20px - env(safe-area-inset-bottom)); overflow-y: auto; overscroll-behavior: contain; display: grid; gap: 14px; padding: 18px 8px 8px; border-radius: var(--r-lg); background: rgb(250 248 244 / .9); -webkit-backdrop-filter: saturate(180%) blur(24px); backdrop-filter: saturate(180%) blur(24px); box-shadow: inset 0 1px 0 rgb(255 255 255 / .8), 0 0 0 1px var(--line), 0 34px 70px -28px rgb(21 20 18 / .55); transform-origin: calc(100% - 22px) -40px; opacity: 0; transform: translateY(-8px) scale(.94); transition: opacity .2s ease, transform var(--spring-s) var(--spring); }
${MENU_OPEN} .sheet__card { opacity: 1; transform: none; }
.sheet__title { padding-inline: 14px; }
.sheet__list a { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 48px; padding: 0 14px; border-radius: 14px; font-size: 1.1875rem; font-weight: 650; line-height: 1.2; letter-spacing: -.012em; text-decoration: none; -webkit-tap-highlight-color: transparent; transition: background-color .15s; }
.sheet__list a:hover, .sheet__list a:active { background: rgb(21 20 18 / .07); }
.sheet__list .i { width: 1.05em; height: 1.05em; color: var(--ink-2); transition: transform .3s var(--spring); }
.sheet__list a:hover .i { transform: translateX(3px); }
/* Rows arrive one after another as the panel opens, and leave together. */
.sheet__list li { opacity: 0; transform: translateY(-6px); transition: opacity .18s ease, transform var(--spring-s) var(--spring); }
${MENU_OPEN} .sheet__list li { opacity: 1; transform: none; transition-delay: calc(40ms + var(--i, 0) * 18ms); }
${Array.from({ length: 12 }, (_, i) => `.sheet__list li:nth-child(${i + 1}) { --i: ${i}; }`).join(' ')}
.sheet__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 4px 6px 6px; }
.sheet__actions .btn { padding-inline: 12px; }
/* Short screens (iPhone SE, phones on their side): tighter rows, then columns, never under 44px to tap. */
@media (max-height: 700px) { .sheet__list a { min-height: 44px; font-size: 1.0625rem; } }
@media (max-height: 520px) { .sheet__card { width: min(640px, 100% - 2 * var(--gutter)); gap: 10px; } .sheet__list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 4px; } }
.menu-off { position: fixed; top: 50%; left: 0; width: 1px; height: 1px; pointer-events: none; }

/* Buttons: feedback on press, 44px+ targets */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 52px; padding: 0 24px; border-radius: 999px; font-size: 1rem; font-weight: 650; line-height: 1.2; letter-spacing: .005em; text-decoration: none; text-align: center; -webkit-tap-highlight-color: transparent; transition: transform .12s ease-out, background-color .2s; }
.btn:active { transform: scale(.97); }
.btn--primary { background: var(--crimson); color: #fff; box-shadow: 0 12px 26px -14px rgb(200 16 46 / .75); }
.btn--primary:active { background: var(--crimson-lo); }
.btn--light { background: var(--bone); color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--line); }
.btn--ghost { color: var(--on-dark); box-shadow: inset 0 0 0 1.5px rgb(243 239 231 / .6); }
.btn--ink { background: var(--black); color: var(--on-dark); }
.btn--sm { min-height: 44px; padding: 0 18px; font-size: .9375rem; }
.btn--block { width: 100%; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; }
.link { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font-weight: 650; color: var(--crimson); text-decoration: none; }
.link:active { opacity: .7; }

/* Hero: photo, then a panel that overlaps its foot; a glass panel over the photo on wide screens */
.hero { padding-top: clamp(12px, 2vw, 24px); padding-bottom: 0; }
.hero__media { border-radius: var(--r-xl); overflow: hidden; overflow: clip; isolation: isolate; background: var(--black); }
.hero__media img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; }
.hero__panel { position: relative; margin: -72px 10px 0; padding: 26px 22px 24px; border-radius: var(--r-xl); background: var(--black); color: var(--on-dark); display: grid; gap: 18px; box-shadow: 0 30px 60px -30px rgb(0 0 0 / .6); }
.hero__panel .lede { color: var(--on-dark-2); }
.hero__panel .eyebrow { color: var(--on-dark); }
/* Both names on one line where they fit; on phones, one name per line rather than a name split in two. */
@media (max-width: 459px) { .hero__panel .eyebrow .ln { display: block; } .hero__panel .eyebrow .sep { display: none; } }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chips li { padding: 8px 14px; border-radius: 999px; background: rgb(243 239 231 / .09); box-shadow: inset 0 0 0 1px var(--line-dark); font-size: .9375rem; font-weight: 600; }
@media (min-width: 760px) {
  .hero__media img { aspect-ratio: 16 / 9; }
  .hero__panel { margin: -96px 28px 0; padding: 32px; }
}
@media (min-width: 1000px) {
  .hero__frame { position: relative; }
  .hero__panel { position: absolute; left: clamp(14px, 2vw, 28px); bottom: clamp(14px, 2vw, 28px); width: min(600px, 60%); margin: 0; padding: clamp(28px, 3vw, 40px); background: rgb(21 20 18 / .84); -webkit-backdrop-filter: blur(22px) saturate(150%); backdrop-filter: blur(22px) saturate(150%); }
  .hero h1 { font-size: clamp(2.8rem, 5vw, 4.4rem); }
}

/* In-page menu: a row of chips that scrolls sideways on phones */
.jump { overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.jump::-webkit-scrollbar { display: none; }
.jump ul { display: flex; gap: 8px; width: max-content; margin-inline: auto; padding: 18px var(--gutter) 6px; }
.jump a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 999px; background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); text-decoration: none; font-size: .9375rem; font-weight: 600; }
.jump a:active { transform: scale(.97); }

/* Adventure cards: a swipeable rail on phones, a grid on wide screens */
.rail { display: grid; grid-auto-flow: column; grid-auto-columns: min(84%, 340px); gap: 14px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: var(--gutter); padding: 4px var(--gutter) 20px; margin-inline: calc(-1 * var(--gutter)); scrollbar-width: none; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
.rail::-webkit-scrollbar { display: none; }
.rail > li { scroll-snap-align: start; }
.hint { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: .9375rem; font-weight: 500; color: var(--ink-2); }
@media (min-width: 900px) {
  .rail { grid-auto-flow: row; grid-template-columns: repeat(3, minmax(0, 1fr)); overflow: visible; margin-inline: 0; padding: 0; }
  .hint { display: none; }
}
/* Frames clip with overflow: clip, not hidden: a hidden box counts as a scroll container and would capture the rail's parallax timeline. */
.card { display: flex; flex-direction: column; background: var(--paper); border-radius: var(--r-lg); overflow: hidden; overflow: clip; box-shadow: inset 0 1px 0 rgb(255 255 255 / .7), 0 18px 40px -28px rgb(21 20 18 / .45); }
.card__media { position: relative; overflow: hidden; overflow: clip; isolation: isolate; }
.card__media img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
.card__body { flex: 1; display: grid; gap: 12px; grid-template-rows: auto auto 1fr auto auto; padding: 20px 18px 14px; }
.card--cta .card__body { grid-template-rows: auto 1fr auto; gap: 14px; padding: 26px 22px 22px; min-height: 280px; }
.card--cta h3 { font-size: 1.625rem; font-weight: 700; letter-spacing: -.022em; }
.card--dark { background: var(--black); color: var(--on-dark); }
.card--dark p { color: var(--on-dark-2); }
.card--crimson { background: var(--crimson); color: #fff; }
.badge { position: absolute; left: 12px; top: 12px; padding: 6px 12px; border-radius: 999px; background: rgb(21 20 18 / .86); color: var(--on-dark); font-size: .8125rem; font-weight: 700; letter-spacing: .02em; }
.facts { display: flex; flex-wrap: wrap; gap: 6px; align-content: start; }
.facts li { padding: 6px 11px; border-radius: 999px; background: var(--chip); font-size: .875rem; font-weight: 600; }
.facts span { color: var(--ink-2); font-weight: 500; }
.price { font-size: 1.75rem; font-weight: 700; line-height: 1.05; letter-spacing: -.02em; }
.price small { display: block; margin-top: 6px; font-size: .875rem; font-weight: 500; line-height: 1.4; letter-spacing: 0; color: var(--ink-2); }
.price--big { font-size: 2.5rem; }
.dark .price small, .bundle--pick .price small { color: var(--on-dark-2); }

/* Bundles */
.bundles { display: grid; gap: 14px; }
@media (min-width: 900px) { .bundles { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; } }
.bundle { display: grid; gap: 16px; align-content: start; grid-template-rows: auto auto auto 1fr auto; padding: 26px 22px 22px; border-radius: var(--r-lg); background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); }
.bundle > .btn { align-self: end; }
.bundle--pick { background: var(--black); color: var(--on-dark); box-shadow: 0 26px 50px -28px rgb(0 0 0 / .6); }
.tag { justify-self: start; padding: 6px 12px; border-radius: 999px; background: var(--crimson); color: #fff; font-size: .8125rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.ticks { display: grid; gap: 10px; }
.ticks li { display: flex; gap: 10px; align-items: flex-start; }
.i--check { margin-top: .2em; color: var(--crimson); }
.bundle--pick .i--check { color: var(--crimson-soft); }
.addons { margin-top: 20px; color: var(--ink-2); }

/* Image + text */
.split { display: grid; gap: clamp(22px, 4vw, 56px); align-items: center; }
.split__media { border-radius: var(--r-xl); overflow: hidden; overflow: clip; isolation: isolate; }
.split__media img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; }
.split__text { display: grid; gap: 18px; }
@media (min-width: 900px) {
  .split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .split--flip .split__media { order: 2; }
}
.steps { display: grid; gap: 14px; counter-reset: step; }
.steps li { display: grid; grid-template-columns: 44px 1fr; gap: 14px; align-items: center; counter-increment: step; font-weight: 500; }
.steps li::before { content: counter(step); display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--crimson); color: #fff; font-size: 1.125rem; font-weight: 700; }
.rules { display: grid; gap: 12px; }
.rules div { padding: 16px 18px; border-radius: var(--r-md); background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); }
.rules dd { margin-top: 2px; color: var(--ink-2); }
details.more { border-radius: var(--r-md); background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); }
details.more summary, .faq summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 56px; padding: 16px 18px; font-weight: 650; line-height: 1.4; }
details.more summary::-webkit-details-marker, .faq summary::-webkit-details-marker { display: none; }
details.more summary::after, .faq summary::after { content: ""; flex: none; width: 10px; height: 10px; margin-right: 4px; border-right: 2.5px solid currentColor; border-bottom: 2.5px solid currentColor; transform: translateY(-3px) rotate(45deg); transition: transform .25s cubic-bezier(.16, 1, .3, 1); }
details[open] > summary::after { transform: translateY(2px) rotate(225deg); }
details.more ul { display: grid; gap: 6px; padding: 0 18px 18px 36px; list-style: disc; color: var(--ink-2); }

/* Groups */
.wide-img { border-radius: var(--r-xl); overflow: hidden; overflow: clip; isolation: isolate; aspect-ratio: 16 / 10; margin-bottom: clamp(20px, 3vw, 32px); }
.wide-img img { width: 100%; height: 100%; object-fit: cover; }
.tiles { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 900px) { .tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (max-width: 380px) { .tiles { grid-template-columns: 1fr; } }
.tile { display: grid; gap: 6px; align-content: start; padding: 18px; border-radius: var(--r-md); background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); }
.tile h3 { font-size: 1.125rem; }
.note { margin-top: 18px; padding: 16px 18px; border-radius: var(--r-md); background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); font-weight: 500; }

/* Menu */
.menu { display: grid; gap: 14px; }
@media (min-width: 700px) { .menu { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.menu > div { padding: 20px; border-radius: var(--r-md); background: rgb(243 239 231 / .06); box-shadow: inset 0 0 0 1px var(--line-dark); }
.menu h3 { font-size: 1.125rem; margin-bottom: 10px; color: var(--crimson-soft); }
.menu li { font-weight: 600; }
.menu li + li { margin-top: 8px; }
.menu li span { display: block; font-size: .9375rem; font-weight: 450; color: var(--on-dark-2); }

/* Visit */
.panels { display: grid; gap: 14px; }
@media (min-width: 900px) { .panels { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.panel { display: grid; gap: 14px; align-content: start; padding: 22px; border-radius: var(--r-lg); background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); }
.hours div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.hours div:last-child { border-bottom: 0; }
.hours dt { font-weight: 650; }
.hours dd { color: var(--ink-2); text-align: right; }
.maps { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.bullets { display: grid; gap: 10px; }
.bullets li { display: flex; gap: 10px; }

/* Questions */
.faq { display: grid; gap: 10px; max-width: 860px; }
.faq details { border-radius: var(--r-md); background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); }
.faq details p { padding: 0 18px 18px; color: var(--ink-2); }

/* Contact band */
.band { position: relative; isolation: isolate; overflow: hidden; color: var(--on-dark); background: var(--black); }
.band > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -2; }
.band::before { content: ""; position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgb(21 20 18 / .76), rgb(21 20 18 / .92)); }
.band .eyebrow { color: var(--on-dark); }
.band .lede { color: var(--on-dark-2); }
.contact-list { display: grid; gap: 10px; margin-top: 24px; color: var(--on-dark-2); }
.contact-list a { color: var(--on-dark); font-weight: 600; }

/* Footer: the stacked logo, with the monogram large and quiet behind */
footer { position: relative; isolation: isolate; overflow: hidden; padding: 48px 0 calc(48px + env(safe-area-inset-bottom)); background: var(--black); color: var(--on-dark-2); font-size: .9375rem; border-top: 1px solid var(--line-dark); }
footer .wrap { display: grid; gap: 14px; }
footer .brand { justify-self: start; margin-bottom: 12px; }
footer a { color: var(--on-dark); }
.watermark { position: absolute; z-index: -1; right: -48px; bottom: -64px; pointer-events: none; }

/* Parallax, from scrolling alone (no script). Text and buttons always move 1:1 with the finger; only photos
   lag behind inside their frames, so the page gains depth without ever feeling loose. On phones the opening
   photo holds still while the panel slides up over it like a sheet, and sinks back as it is covered.
   Off when the reader asks for reduced motion. Browsers without scroll-driven animations keep still photos.
   Durations are 1ms because a scroll timeline sets the pace; Firefox needs a non-zero one to run at all. */
@media screen and (prefers-reduced-motion: no-preference) {
  @media (max-width: 999px) {
    .hero__media { position: sticky; top: calc(64px + env(safe-area-inset-top) + clamp(12px, 2vw, 24px)); }
    .hero__panel { z-index: 1; }
  }
  @supports (animation-timeline: view()) {
    .split__media, .wide-img, .hero__media { view-timeline: --frame block; }
    .split__media img, .wide-img img { animation: st-drift 1ms linear both; animation-timeline: --frame; }
    .band { view-timeline: --band block; }
    .band > img { animation: st-drift-deep 1ms linear both; animation-timeline: --band; }
    footer { view-timeline: --foot block; }
    .watermark { animation: st-rise 1ms linear both; animation-timeline: --foot; animation-range: entry 0% entry 100%; }
    @media (max-width: 899px) {
      .card__media { view-timeline: --card inline; }
      .card__media img { animation: st-drift-x 1ms linear both; animation-timeline: --card; }
    }
    @media (max-width: 999px) {
      .hero__media { transform-origin: 50% 0; animation: st-sink 1ms linear both; animation-timeline: scroll(root block); animation-range: 0px 400px; }
      .hero__media::after { content: ""; position: absolute; inset: 0; background: var(--black); opacity: 0; pointer-events: none; animation: st-dim 1ms linear both; animation-timeline: scroll(root block); animation-range: 0px 400px; }
    }
    @media (min-width: 1000px) {
      .hero__media img { animation: st-hero 1ms linear both; animation-timeline: --frame; animation-range: exit 0% exit 100%; }
    }
  }
}
@keyframes st-drift { from { transform: translateY(-6%) scale(1.14); } to { transform: translateY(6%) scale(1.14); } }
@keyframes st-drift-deep { from { transform: translateY(-9%) scale(1.2); } to { transform: translateY(9%) scale(1.2); } }
@keyframes st-drift-x { from { transform: translateX(-6%) scale(1.14); } to { transform: translateX(6%) scale(1.14); } }
@keyframes st-hero { from { transform: scale(1.16); } to { transform: translateY(7%) scale(1.16); } }
@keyframes st-rise { from { transform: translateY(30%); } }
@keyframes st-sink { to { transform: scale(.92); } }
@keyframes st-dim { to { opacity: .45; } }

/* Accessibility preferences */
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } .btn, .jump a, details summary::after { transition: none; } .btn:active, .jump a:active { transform: none; }
  /* The menu fades in and out in place: no growing, sliding or turning. The X still shows, just without the turn. */
  .sheet__card, .sheet__list li, .toggle a:active, .toggle__state:active + .toggle__face, .sheet__list a:hover .i { transform: none; }
  .bars span, .sheet__list .i { transition: none; } }
@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) { .bar { background: var(--bone); } .hero__panel { background: var(--black); } }
@media (prefers-reduced-transparency: reduce) { .bar { background: var(--bone); -webkit-backdrop-filter: none; backdrop-filter: none; } .sheet__card { background: var(--paper); -webkit-backdrop-filter: none; backdrop-filter: none; } .hero__panel { background: var(--black); -webkit-backdrop-filter: none; backdrop-filter: none; } }
@media (prefers-contrast: more) {
  .card, .bundle, .tile, .panel, .rules div, .faq details, details.more, .jump a, .note, .toggle a, .toggle__face { box-shadow: inset 0 0 0 2px var(--ink); }
  .sheet__card { background: var(--paper); box-shadow: 0 0 0 2px var(--ink), 0 34px 70px -28px rgb(21 20 18 / .55); }
  .sheet__list .i { color: var(--ink); }
  .muted, .lede, .facts span, .hours dd, .price small, .hint, .addons, .rules dd, .faq details p { color: var(--ink); }
  .dark .lede, .dark .muted, .hero__panel .lede, .band .lede, .card--dark p, .contact-list, footer { color: var(--on-dark); }
}
@media print { .bar, .jump, .skip, .hint, .watermark, .sheet { display: none; } .rail { grid-auto-flow: row; grid-template-columns: repeat(2, 1fr); overflow: visible; margin: 0; padding: 0; } .card, .bundle, .panel, .tile { break-inside: avoid; } section { padding-block: 28px; } }
`;

const minCss = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{};,>])\s*/g, '$1')
  .replace(/:\s+/g, ':')
  .trim();

// ------------------------------------------------------------------ page

const navItems: [string, string][] = [
  ['adventures', 'Adventures'],
  ['bundles', 'Bundles'],
  ['scream-clip', 'Scream Clip'],
  ['safety', 'Safety'],
  ['groups', 'Groups'],
  ['gifts', 'Gifts'],
  ['food', 'Food'],
  ['visit', 'Visit'],
  ['questions', 'Questions'],
  ['contact', 'Contact'],
];

const html = `<!doctype html>
<html lang="en-ZA" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="${stColors.bone}">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="author" content="${esc(site.name)}">
<meta name="application-name" content="${esc(site.name)}">
<meta name="apple-mobile-web-app-title" content="${esc(site.name)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${SITE}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="en_ZA">
<meta property="og:url" content="${SITE}/">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/og/home.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(image('towers-mural-hero').alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/og/home.jpg">
<meta name="geo.region" content="${site.address.regionCode}">
<meta name="geo.placename" content="${esc(`${site.address.suburb}, ${site.address.city}`)}">
<meta name="geo.position" content="${site.geo.lat};${site.geo.lng}">
<meta name="ICBM" content="${site.geo.lat}, ${site.geo.lng}">
<link rel="icon" type="image/svg+xml" href="${faviconSvg}">
<link rel="apple-touch-icon" href="${touchIcon}">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
<style>${minCss}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="bar">
  <div class="wrap bar__in">
    <a class="brand" href="#top">${headerLockup}</a>
    <div class="bar__end">
      <a class="btn btn--primary btn--sm" href="${wa(BOOK_TEXT)}">${icon.whatsapp}Book</a>
      <div class="toggle">
        <input class="toggle__state" type="checkbox" id="menu-toggle" aria-label="Menu" aria-controls="menu">
        <span class="toggle__face" aria-hidden="true">${bars}</span>
        <a class="toggle__open" href="#menu">${bars}<span class="vh">Menu</span></a>
        <a class="toggle__close" href="#menu-closed">${bars}<span class="vh">Close menu</span></a>
      </div>
    </div>
  </div>
</header>
<nav class="sheet" id="menu" aria-label="Menu" tabindex="-1">
  <label class="sheet__scrim sheet__scrim--box" for="menu-toggle" aria-hidden="true"><span class="vh">Close menu</span></label>
  <a class="sheet__scrim sheet__scrim--link" href="#menu-closed" tabindex="-1" aria-hidden="true"><span class="vh">Close menu</span></a>
  <div class="sheet__card">
    <p class="eyebrow sheet__title">On this page</p>
    <ul class="sheet__list">
      ${navItems.map(([id, label]) => `<li><a href="#${id}">${label}${icon.arrow}</a></li>`).join('\n      ')}
    </ul>
    <div class="sheet__actions">
      <a class="btn btn--primary btn--sm" href="${wa('Hi Soweto Towers! ')}">${icon.whatsapp}WhatsApp</a>
      <a class="btn btn--light btn--sm" href="tel:${site.phone.e164}">${icon.phone}Call</a>
    </div>
  </div>
</nav>
<span class="menu-off" id="menu-closed"></span>

<main id="main">
<section class="hero" id="top" aria-labelledby="hero-title">
  <div class="wrap hero__frame">
    <div class="hero__media">
      <picture>
        <source media="(min-width: 760px)" srcset="${heroWide.src}" width="${heroWide.width}" height="${heroWide.height}">
        ${img(heroTall, { eager: true })}
      </picture>
    </div>
    <div class="hero__panel">
      <p class="eyebrow"><span><span class="ln">Soweto Towers</span><span class="sep"> · </span><span class="ln">Orlando Towers</span></span></p>
      <h1 id="hero-title">Soweto, from the top.</h1>
      <p class="lede">A 100m bungee from the bridge between the painted cooling towers, a freefall inside the tower, a zipline over the Orlando Dam and a 360° view of the city that raised you.</p>
      <div class="actions">
        <a class="btn btn--primary" href="${wa(BOOK_TEXT)}">${icon.whatsapp}Book on WhatsApp</a>
        <a class="btn btn--ghost" href="#adventures">See prices</a>
      </div>
      <ul class="chips" aria-label="At a glance">
        <li>Bungee ${rand(bungee.price)}</li><li>Lift ride ${rand(lift.price)}</li><li>Thursday to Sunday</li><li>Open till sunset</li>
      </ul>
    </div>
  </div>
</section>

<nav class="jump" aria-label="On this page">
  <ul>${navItems.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}</ul>
</nav>

<section id="adventures" aria-labelledby="adventures-title">
  <div class="wrap">
    <div class="head">
      <p class="eyebrow">Seven ways up</p>
      <h2 id="adventures-title">Pick your drop.</h2>
      <p class="lede">Prices are per person. Tell us the day and how many of you, and the crew confirms your time on WhatsApp.</p>
    </div>
    <ul class="rail" aria-label="Adventures and prices" tabindex="0">
${adventureCards}
${ctaCards}
    </ul>
    <p class="hint" aria-hidden="true">Swipe for more adventures ${icon.arrow}</p>
  </div>
</section>

<section id="bundles" class="tint" aria-labelledby="bundles-title">
  <div class="wrap">
    <div class="head">
      <p class="eyebrow">Bundles</p>
      <h2 id="bundles-title">Make it count.</h2>
      <p class="lede">The jump and the film together, for less.</p>
    </div>
    <ul class="bundles">
${bundleCards}
    </ul>
    <p class="addons">Add to any adventure: ${Object.values(addons)
      .map((x) => `${esc(x.name.toLowerCase().replace(/^full hd/, 'full HD'))} ${rand(x.price)}`)
      .join(' · ')}, per person, per activity. Video is already included with the ${esc(scad.name)} and the straightjacket bungee.</p>
  </div>
</section>

<section id="scream-clip" class="dark" aria-labelledby="scream-title">
  <div class="wrap split">
    <div class="split__media">${img(scream)}</div>
    <div class="split__text">
      <p class="eyebrow">${esc(site.hashtags[1] ?? '#100mClub')}</p>
      <h2 id="scream-title">Your scream, on WhatsApp.</h2>
      <p class="lede">Every bungee jumper gets a free 10-second Scream Clip. Add the full HD video for ${rand(addons.video.price)} to keep the whole jump.</p>
      <ol class="steps">
        <li><span>You jump.</span></li>
        <li><span>The multimedia crew cuts your clip.</span></li>
        <li><span>It lands on the WhatsApp number you booked with.</span></li>
      </ol>
    </div>
  </div>
</section>

<section id="safety" aria-labelledby="safety-title">
  <div class="wrap split split--flip">
    <div class="split__media">${img(safety)}</div>
    <div class="split__text">
      <p class="eyebrow">Safe hands</p>
      <h2 id="safety-title">Scared? Good.</h2>
      <p class="lede">Being scared is part of it. Being unsure isn’t. Here is how the crew looks after you.</p>
      <dl class="rules">
        <div><dt>Weight limits</dt><dd>${esc(bungee.name)} and straightjacket ${bungee.rules.minWeightKg}–${bungee.rules.maxWeightKg} kg. ${esc(scad.name)} ${scad.rules.minWeightKg}–${scad.rules.maxWeightKg} kg.</dd></div>
        <div><dt>Age</dt><dd>Nobody under ${bungee.rules.minAge} goes up the tower. Under-${bungee.rules.consentUnder}s need signed consent from a parent or guardian.</dd></div>
        <div><dt>One at a time</dt><dd>No tandem jumps. It is always one jumper at a time.</dd></div>
        <div><dt>Weather</dt><dd>Rain stops everything until the crew re-rigs, and lightning detectors bring everyone down straight away.</dd></div>
      </dl>
      <details class="more">
        <summary>Who shouldn’t jump</summary>
        <ul>${medicalExclusions.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      </details>
    </div>
  </div>
</section>

<section id="groups" class="tint" aria-labelledby="groups-title">
  <div class="wrap">
    <div class="head">
      <p class="eyebrow">Groups</p>
      <h2 id="groups-title">Bring the whole crew.</h2>
      <p class="lede">Birthdays, team days, school outings and tour groups. Thursdays and Fridays are the quietest days at the towers, which makes them the best days for groups.</p>
    </div>
    <div class="wide-img">${img(groups)}</div>
    <ul class="tiles">
      <li class="tile"><h3>Celebrations</h3><p class="muted small">Birthdays and bucket lists. Birthday cake is welcome.</p></li>
      <li class="tile"><h3>Team days</h3><p class="muted small">Paid upfront, with invoicing for companies.</p></li>
      <li class="tile"><h3>Schools</h3><p class="muted small">For learners ${bungee.rules.minAge} and older, with signed consent for under-${bungee.rules.consentUnder}s.</p></li>
      <li class="tile"><h3>Tours and hotels</h3><p class="muted small">Bring your guests for the view or the drop. Ask us about a partner offer.</p></li>
    </ul>
    <p class="note">Groups of ${bungee.group!.min} or more pay ${rand(bungee.group!.price)} each for the bungee and ${rand(scad.group!.price)} each for the SCAD freefall. Lift rides are ${rand(lift.group!.price)} each for ${lift.group!.min} or more.</p>
    <div class="actions" style="margin-top:20px"><a class="btn btn--primary" href="${wa('Hi Soweto Towers! I would like to plan a group day.\nGroup size: \nDate: \nOccasion: ')}">${icon.whatsapp}Plan a group day</a></div>
  </div>
</section>

<section id="gifts" aria-labelledby="gifts-title">
  <div class="wrap split">
    <div class="split__media">${img(gift)}</div>
    <div class="split__text">
      <p class="eyebrow">Gift a Jump</p>
      <h2 id="gifts-title">Give someone a story.</h2>
      <p class="lede">A voucher for a jump, a bundle or any amount, valid for 365 days. We send it by WhatsApp or email on the day you choose, or you print it.</p>
      <div class="actions"><a class="btn btn--primary" href="${wa('Hi Soweto Towers! I would like to buy a Gift a Jump voucher.\nFor: \nAdventure or amount: \nSend it on: ')}">${icon.whatsapp}Order a gift voucher</a></div>
    </div>
  </div>
</section>

<section id="food" class="dark" aria-labelledby="food-title">
  <div class="wrap">
    <div class="split">
      <div class="split__media">${img(food, { className: 'food-img' })}</div>
      <div class="split__text">
        <p class="eyebrow">Chaf-Pozi, on site</p>
        <h2 id="food-title">Jump, then braai.</h2>
        <p class="lede">Chaf-Pozi sits at the foot of the towers: shisanyama off the coals, cold drinks and a front-row seat for the next jumper.</p>
        <div class="actions"><a class="btn btn--primary" href="${wa('Hi Chaf-Pozi! I would like to book a table.\nDate: \nTime: \nNumber of people: ')}">${icon.whatsapp}Ask about a table</a></div>
      </div>
    </div>
    <div class="menu" style="margin-top:28px">
      ${menu.map((s) => `<div><h3>${esc(s.section)}</h3><ul>${s.items.map((i) => `<li>${esc(i.name)}${i.description ? `<span>${esc(i.description)}</span>` : ''}</li>`).join('')}</ul></div>`).join('')}
    </div>
    <p class="muted small" style="margin-top:16px">No outside food or braais, please. Birthday cake is welcome.</p>
  </div>
</section>

<section id="visit" aria-labelledby="visit-title">
  <div class="wrap">
    <div class="head">
      <p class="eyebrow">Plan your visit</p>
      <h2 id="visit-title">Everything before the step.</h2>
    </div>
    <div class="wide-img">${img(visit)}</div>
    <div class="panels">
      <div class="panel">
        <h3>Opening hours</h3>
        <dl class="hours">${hours.map((h) => `<div><dt>${esc(h.label)}</dt><dd>${esc(h.value)}</dd></div>`).join('')}</dl>
        <p class="muted small">We close at sunset: around ${summerSunset} in late December and ${winterSunset} in late June.</p>
      </div>
      <div class="panel">
        <h3>Getting here</h3>
        <p class="bullets"><span style="display:flex;gap:10px">${icon.pin}<span>${esc(site.address.street)}<br>${esc(site.address.suburb)}, ${esc(site.address.city)}</span></span></p>
        <p class="muted small">Search “Soweto Towers” in your maps app, or tap one below.</p>
        <div class="maps">
          <a class="btn btn--light btn--sm" href="${esc(directions.google)}">Google Maps</a>
          <a class="btn btn--light btn--sm" href="${esc(directions.apple)}">Apple Maps</a>
          <a class="btn btn--light btn--sm" href="${esc(directions.waze)}">Waze</a>
          <a class="btn btn--light btn--sm" href="${esc(directions.uber)}">Uber</a>
        </div>
      </div>
      <div class="panel">
        <h3>On the day</h3>
        <ul class="bullets">
          <li>${icon.check}<span>Entrance is ${rand(site.entranceFee)} per person at the gate. The site is cash-free, so please pay by card.</span></li>
          <li>${icon.check}<span>Arrive about 20 minutes before your slot.</span></li>
          <li>${icon.check}<span>Wear clothes you can jump in (preferably not a skirt), closed shoes and sunscreen.</span></li>
          <li>${icon.check}<span>Phones and GoPros stay off the bridge and out of the tower. Your Scream Clip has you covered.</span></li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section id="questions" class="tint" aria-labelledby="questions-title">
  <div class="wrap">
    <div class="head">
      <p class="eyebrow">Questions</p>
      <h2 id="questions-title">Asked and answered.</h2>
    </div>
    <div class="faq">
      ${faqPicks.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n      ')}
    </div>
  </div>
</section>

<section id="contact" class="band" aria-labelledby="contact-title">
  ${img(contact)}
  <div class="wrap">
    <div class="head">
      <p class="eyebrow">Talk to the crew</p>
      <h2 id="contact-title">Ready when you are.</h2>
      <p class="lede">WhatsApp is quickest. The office answers calls from 09:00 to 17:00.</p>
    </div>
    <div class="actions">
      <a class="btn btn--primary" href="${wa('Hi Soweto Towers! ')}">${icon.whatsapp}WhatsApp us</a>
      <a class="btn btn--ghost" href="tel:${site.phone.e164}">${icon.phone}Call ${esc(site.phone.display)}</a>
      <a class="btn btn--ghost" href="mailto:${site.email}">${icon.mail}Email us</a>
    </div>
    <ul class="contact-list">
      <li>WhatsApp: <a href="${wa('Hi Soweto Towers! ')}">${esc(site.whatsapp.display)}</a></li>
      <li>Also: <a href="tel:${site.phoneAlt.e164}">${esc(site.phoneAlt.display)}</a> (Wednesday to Sunday)</li>
      <li>Email: <a href="mailto:${site.email}">${esc(site.email)}</a></li>
      <li>Film shoots, venue hire and base jumping: <a href="mailto:${site.emailVenue}">${esc(site.emailVenue)}</a></li>
      <li><a href="${esc(site.socials.facebook)}">Facebook</a> · <a href="${esc(site.socials.youtube)}">YouTube</a></li>
    </ul>
  </div>
</section>
</main>

<footer>
  ${watermark}
  <div class="wrap">
    <a class="brand" href="#top">${footerLockup}</a>
    <p>${esc(site.address.street)}, ${esc(site.address.suburb)}, ${esc(site.address.city)} · <a href="${SITE}/">sowetotowers.co.za</a></p>
    <p class="small">Prices in South African rand, per person, as of ${esc(formatDate(ymdInSast(new Date())))}. Prices and times can change, so please confirm when you book.</p>
    <p class="small">© ${year} ${esc(site.name)}. ${esc(site.hashtags.join(' '))}</p>
  </div>
</footer>
<script>${enhance}</script>
</body>
</html>
`;

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, html);
const total = (await stat(outFile)).size;
console.log(
  `${path.relative(process.cwd(), outFile)}  ${(total / 1024 / 1024).toFixed(2)} MB  (photos ${(imageBytes / 1024).toFixed(0)} KB as WebP, font ${(Buffer.from(font, 'base64').length / 1024).toFixed(0)} KB)`,
);
