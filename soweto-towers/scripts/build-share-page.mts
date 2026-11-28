/**
 * One self-contained HTML page about Soweto Towers, for sharing on WhatsApp
 * and opening on any phone, with no internet connection needed.
 *
 *   npm run share:page            (writes share/Soweto-Towers.html)
 *   npx tsx scripts/build-share-page.mts [out.html]
 *
 * - Everything is inside the one file: photos (WebP), the Exo 2 font, the
 *   favicon and touch icon. Nothing is fetched from the network.
 * - No JavaScript at all. WhatsApp's document viewer on iPhone (Quick Look)
 *   and some Android viewers switch scripts off, so every part works without:
 *   in-page links, native <details> for questions, CSS-only scrolling rails.
 * - Metadata for search and link previews (title, description, Open Graph,
 *   Twitter, geo tags, JSON-LD) points at the live site, so the same file can
 *   also be hosted as-is.
 * - All facts, prices, rules and hours come from the website's own content
 *   modules, so the page always matches the site. Re-run after changing them.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { markSvg } from '../src/components/brand/mark-paths';
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
    '<svg class="i i--check" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 10.5 3 3 7-7"/></svg>',
  arrow:
    '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

// -------------------------------------------------------------- assets

const font = (await readFile(path.join(root, 'src', 'fonts', 'exo-2-latin-wght-normal.woff2'))).toString('base64');
const markPlain = `data:image/svg+xml;base64,${Buffer.from(markSvg({ size: 64, background: 'none' })).toString('base64')}`;
const faviconSvg = `data:image/svg+xml;base64,${Buffer.from(markSvg({ size: 64, background: 'charcoal', radius: 14, inset: 0.08 })).toString('base64')}`;
const touchIcon = `data:image/png;base64,${(
  await sharp(Buffer.from(markSvg({ size: 180, background: 'charcoal', inset: 0.14 })))
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
    tone: 'orange',
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
  <a class="btn ${p.recommended ? 'btn--primary' : 'btn--light'} btn--block" href="${wa(bookText(`the ${p.name} bundle`))}">${icon.whatsapp}Book ${esc(p.name)}</a>
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

const css = /* css */ `
@font-face { font-family: "Exo 2"; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 100 900; font-style: normal; font-display: swap; }
:root {
  --canvas: #e2e3de; --paper: #f9f9f7; --paper-2: #efefea; --char: #2d2d2f; --char-lo: #1f1f21; --ink: #1e2020; --ink-2: #4a4c4c;
  --on-dark: #f4f3ef; --on-dark-2: #c9cac6; --orange: #e3501c; --orange-hi: #ee6a34; --rust: #a23e18; --coral: #f3a07e;
  --line: rgb(30 32 32 / .12); --line-dark: rgb(255 255 255 / .14);
  --r-xl: 28px; --r-lg: 22px; --r-md: 16px; --gutter: clamp(16px, 4vw, 40px); --max: 1200px;
  --display: "Exo 2", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --body: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color-scheme: light;
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; scroll-behavior: smooth; scroll-padding-top: 84px; }
@supports (font: -apple-system-body) { html { font: -apple-system-body; } }
body { margin: 0; font-family: var(--body); font-size: 1rem; line-height: 1.55; color: var(--ink); background: var(--canvas); -webkit-font-smoothing: antialiased; }
img { display: block; max-width: 100%; height: auto; }
a { color: inherit; }
p, ul, ol, dl, dd, figure { margin: 0; }
ul, ol { padding: 0; list-style: none; }
h1, h2, h3 { margin: 0; font-family: var(--display); font-weight: 300; text-transform: uppercase; text-wrap: balance; }
h1 { font-size: clamp(2.7rem, 11vw, 5.4rem); line-height: .93; letter-spacing: -.012em; }
h2 { font-size: clamp(2.1rem, 7.4vw, 3.7rem); line-height: .97; letter-spacing: -.008em; }
h3 { font-size: 1.32rem; font-weight: 500; line-height: 1.08; letter-spacing: .01em; }
.eyebrow { font-family: var(--display); font-weight: 600; font-size: .78rem; letter-spacing: .2em; text-transform: uppercase; color: var(--rust); }
.lede { font-size: 1.12em; line-height: 1.5; color: var(--ink-2); max-width: 44ch; text-wrap: pretty; }
.muted { color: var(--ink-2); }
.small { font-size: .9em; }
.i { width: 1.25em; height: 1.25em; flex: none; }
.wrap { width: min(100% - 2 * var(--gutter), var(--max)); margin-inline: auto; }
section { padding-block: clamp(56px, 10vw, 112px); }
.head { display: grid; gap: 14px; margin-bottom: clamp(24px, 4vw, 40px); max-width: 780px; }
.dark { background: var(--char-lo); color: var(--on-dark); }
.dark .eyebrow { color: var(--coral); }
.dark .lede, .dark .muted { color: var(--on-dark-2); }
.paper { background: var(--paper); }

/* Skip link and focus */
.skip { position: absolute; left: 12px; top: -80px; z-index: 50; padding: 12px 16px; border-radius: 12px; background: var(--char-lo); color: #fff; font-weight: 600; text-decoration: none; }
.skip:focus { top: calc(12px + env(safe-area-inset-top)); }
:focus-visible { outline: 3px solid var(--orange); outline-offset: 3px; border-radius: 10px; }

/* Header: a translucent bar the page scrolls under */
.bar { position: sticky; top: 0; z-index: 20; padding-top: env(safe-area-inset-top); background: rgb(226 227 222 / .8); -webkit-backdrop-filter: saturate(180%) blur(18px); backdrop-filter: saturate(180%) blur(18px); box-shadow: 0 1px 0 var(--line); }
.bar__in { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 64px; }
.brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--ink); min-height: 44px; }
.brand img { width: 36px; height: 36px; }
.brand b { display: block; font-family: var(--display); font-weight: 600; font-size: .95rem; letter-spacing: .16em; text-transform: uppercase; line-height: 1; }
.brand small { display: block; margin-top: 5px; font-family: var(--display); font-size: .62rem; letter-spacing: .3em; text-transform: uppercase; color: var(--ink-2); line-height: 1; }

/* Buttons: feedback on press, 44px+ targets */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 52px; padding: 0 24px; border-radius: 999px; font-family: var(--display); font-weight: 600; font-size: .88rem; letter-spacing: .12em; text-transform: uppercase; text-decoration: none; text-align: center; -webkit-tap-highlight-color: transparent; transition: transform .12s ease-out, filter .2s; }
.btn:active { transform: scale(.97); }
.btn--primary { background: linear-gradient(180deg, var(--orange-hi), var(--orange)); color: #121212; box-shadow: 0 12px 26px -14px rgb(227 80 28 / .8); }
.btn--light { background: var(--paper); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line); }
.btn--ghost { color: var(--on-dark); box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / .55); }
.btn--sm { min-height: 44px; padding: 0 18px; font-size: .8rem; }
.btn--block { width: 100%; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; }
.link { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font-weight: 600; color: var(--rust); text-decoration: none; }
.link:active { opacity: .7; }

/* Hero: photo, then a panel that overlaps its foot on phones; a glass panel over it on wider screens */
.hero { padding-top: clamp(12px, 2vw, 24px); padding-bottom: 0; }
.hero__media { border-radius: var(--r-xl); overflow: hidden; background: var(--char); }
.hero__media img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; }
.hero__panel { position: relative; margin: -72px 10px 0; padding: 26px 22px 24px; border-radius: var(--r-xl); background: rgb(26 26 28 / .95); color: var(--on-dark); display: grid; gap: 16px; box-shadow: 0 30px 60px -30px rgb(0 0 0 / .6); }
.hero__panel .lede { color: var(--on-dark-2); }
.hero__panel .eyebrow { color: var(--coral); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chips li { padding: 8px 14px; border-radius: 999px; background: rgb(255 255 255 / .08); box-shadow: inset 0 0 0 1px var(--line-dark); font-size: .82rem; font-weight: 600; letter-spacing: .02em; }
@media (min-width: 760px) {
  .hero__frame { position: relative; }
  .hero__media img { aspect-ratio: 16 / 9; }
  .hero__panel { position: absolute; left: clamp(14px, 2vw, 28px); bottom: clamp(14px, 2vw, 28px); width: min(580px, 60%); margin: 0; padding: clamp(24px, 3vw, 40px); background: rgb(26 26 28 / .8); -webkit-backdrop-filter: blur(22px) saturate(150%); backdrop-filter: blur(22px) saturate(150%); }
  .hero h1 { font-size: clamp(2.6rem, 5.2vw, 4.6rem); }
}

/* In-page menu: a row of chips that scrolls sideways on phones */
.jump { overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.jump::-webkit-scrollbar { display: none; }
.jump ul { display: flex; gap: 8px; width: max-content; margin-inline: auto; padding: 18px var(--gutter) 6px; }
.jump a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 999px; background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); text-decoration: none; font-weight: 600; font-size: .92rem; }
.jump a:active { transform: scale(.97); }

/* Adventure cards: a swipeable rail on phones, a grid on wide screens */
.rail { display: grid; grid-auto-flow: column; grid-auto-columns: min(82%, 340px); gap: 14px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: var(--gutter); padding: 4px var(--gutter) 20px; margin-inline: calc(-1 * var(--gutter)); scrollbar-width: none; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
.rail::-webkit-scrollbar { display: none; }
.rail > li { scroll-snap-align: start; }
.hint { margin-top: 4px; font-size: .85rem; color: var(--ink-2); }
@media (min-width: 900px) {
  .rail { grid-auto-flow: row; grid-template-columns: repeat(3, minmax(0, 1fr)); overflow: visible; margin-inline: 0; padding: 0; }
  .hint { display: none; }
}
.card { display: flex; flex-direction: column; background: var(--paper); border-radius: var(--r-lg); overflow: hidden; box-shadow: 0 1px 0 rgb(255 255 255 / .7) inset, 0 18px 40px -28px rgb(30 32 32 / .5); }
.card__media { position: relative; }
.card--cta .card__body { grid-template-rows: auto 1fr auto; align-content: end; gap: 14px; padding: 26px 22px 22px; min-height: 260px; }
.card--cta h3 { font-size: 1.6rem; font-weight: 300; }
.card--dark { background: var(--char); color: var(--on-dark); }
.card--dark p { color: var(--on-dark-2); }
.card--orange { background: linear-gradient(160deg, var(--orange-hi), var(--orange)); color: #121212; }
.btn--ink { background: #1f1f21; color: var(--on-dark); }
.card__media img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
.badge { position: absolute; left: 12px; top: 12px; padding: 6px 12px; border-radius: 999px; background: rgb(31 31 33 / .82); color: var(--on-dark); font-size: .75rem; font-weight: 700; letter-spacing: .04em; }
.card__body { flex: 1; display: grid; gap: 12px; grid-template-rows: auto auto 1fr auto auto; padding: 18px 18px 14px; }
.facts { display: flex; flex-wrap: wrap; gap: 6px; align-content: start; }
.facts li { padding: 6px 10px; border-radius: 999px; background: var(--paper-2); font-size: .8rem; font-weight: 600; }
.facts span { color: var(--ink-2); font-weight: 500; }
.price { font-family: var(--display); font-weight: 700; font-size: 1.7rem; line-height: 1.05; letter-spacing: .01em; }
.price small { display: block; margin-top: 4px; font-family: var(--body); font-size: .8rem; font-weight: 500; letter-spacing: 0; color: var(--ink-2); }
.price--big { font-size: 2.4rem; }
.dark .price small, .bundle--pick .price small { color: var(--on-dark-2); }

/* Bundles */
.bundles { display: grid; gap: 14px; }
@media (min-width: 900px) { .bundles { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; } }
.bundle { display: grid; gap: 16px; align-content: start; grid-template-rows: auto auto auto 1fr auto; padding: 26px 22px 22px; border-radius: var(--r-lg); background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); }
.bundle--pick { background: var(--char); color: var(--on-dark); box-shadow: 0 26px 50px -28px rgb(0 0 0 / .6); }
.tag { justify-self: start; padding: 6px 12px; border-radius: 999px; background: var(--orange); color: #121212; font-size: .75rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.ticks { display: grid; gap: 10px; }
.ticks li { display: flex; gap: 10px; align-items: flex-start; }
.i--check { margin-top: .15em; color: var(--orange); }
.addons { margin-top: 18px; color: var(--ink-2); }

/* Image + text */
.split { display: grid; gap: clamp(22px, 4vw, 56px); align-items: center; }
.split__media img { width: 100%; border-radius: var(--r-xl); aspect-ratio: 4 / 5; object-fit: cover; }
.split__text { display: grid; gap: 16px; }
@media (min-width: 900px) {
  .split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .split--flip .split__media { order: 2; }
}
.steps { display: grid; gap: 14px; counter-reset: step; }
.steps li { display: grid; grid-template-columns: 44px 1fr; gap: 14px; align-items: center; counter-increment: step; }
.steps li::before { content: counter(step); display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--orange); color: #121212; font-family: var(--display); font-weight: 700; font-size: 1.1rem; }
.rules { display: grid; gap: 12px; }
.rules div { padding: 16px 18px; border-radius: var(--r-md); background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); }
.rules dt { font-weight: 700; }
.rules dd { color: var(--ink-2); }
details.more { border-radius: var(--r-md); background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); }
details.more summary, .faq summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 56px; padding: 14px 18px; font-weight: 700; }
details.more summary::-webkit-details-marker, .faq summary::-webkit-details-marker { display: none; }
details.more summary::after, .faq summary::after { content: ""; flex: none; width: 10px; height: 10px; margin-right: 4px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: translateY(-3px) rotate(45deg); transition: transform .25s cubic-bezier(.16, 1, .3, 1); }
details[open] > summary::after { transform: translateY(2px) rotate(225deg); }
details.more ul { display: grid; gap: 6px; padding: 0 18px 18px 36px; list-style: disc; color: var(--ink-2); }

/* Groups */
.wide-img { width: 100%; border-radius: var(--r-xl); aspect-ratio: 16 / 10; object-fit: cover; margin-bottom: clamp(20px, 3vw, 32px); }
.tiles { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 900px) { .tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (max-width: 380px) { .tiles { grid-template-columns: 1fr; } }
.tile { display: grid; gap: 6px; align-content: start; padding: 18px; border-radius: var(--r-md); background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); }
.tile h3 { font-size: 1.05rem; }
.note { margin-top: 18px; padding: 16px 18px; border-radius: var(--r-md); background: var(--paper-2); }

/* Menu */
.menu { display: grid; gap: 14px; }
@media (min-width: 700px) { .menu { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.menu > div { padding: 18px; border-radius: var(--r-md); background: rgb(255 255 255 / .06); box-shadow: inset 0 0 0 1px var(--line-dark); }
.menu h3 { font-size: 1rem; margin-bottom: 8px; color: var(--coral); }
.menu li + li { margin-top: 6px; }
.menu li span { display: block; font-size: .88rem; color: var(--on-dark-2); }

/* Visit */
.panels { display: grid; gap: 14px; }
@media (min-width: 900px) { .panels { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.panel { display: grid; gap: 14px; align-content: start; padding: 22px; border-radius: var(--r-lg); background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); }
.hours div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.hours div:last-child { border-bottom: 0; }
.hours dt { font-weight: 600; }
.hours dd { color: var(--ink-2); text-align: right; }
.maps { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.bullets { display: grid; gap: 10px; }
.bullets li { display: flex; gap: 10px; }

/* Questions */
.faq { display: grid; gap: 10px; max-width: 860px; }
.faq details { border-radius: var(--r-md); background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); }
.faq details p { padding: 0 18px 18px; color: var(--ink-2); }

/* Contact band */
.band { position: relative; isolation: isolate; overflow: hidden; color: var(--on-dark); background: var(--char-lo); }
.band > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -2; }
.band::before { content: ""; position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgb(20 20 22 / .74), rgb(20 20 22 / .9)); }
.band .lede { color: var(--on-dark-2); }
.contact-list { display: grid; gap: 8px; margin-top: 20px; color: var(--on-dark-2); font-size: .95rem; }
.contact-list a { color: var(--on-dark); }

footer { padding: 40px 0 calc(40px + env(safe-area-inset-bottom)); background: var(--char-lo); color: var(--on-dark-2); font-size: .9rem; border-top: 1px solid var(--line-dark); }
footer .wrap { display: grid; gap: 14px; }
footer .brand { color: var(--on-dark); }
footer .brand small { color: var(--on-dark-2); }

/* Accessibility preferences */
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } .btn, .jump a, details summary::after { transition: none; } .btn:active, .jump a:active { transform: none; } }
@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) { .bar { background: var(--canvas); } .hero__panel { background: rgb(26 26 28 / .95); } }
@media (prefers-reduced-transparency: reduce) { .bar { background: var(--canvas); -webkit-backdrop-filter: none; backdrop-filter: none; } .hero__panel { background: rgb(26 26 28 / .96); -webkit-backdrop-filter: none; backdrop-filter: none; } }
@media (prefers-contrast: more) { .card, .bundle, .tile, .panel, .rules div, .faq details, details.more, .jump a { box-shadow: inset 0 0 0 2px var(--ink); } .muted, .lede, .facts span, .hours dd { color: var(--ink); } }
@media print { .bar, .jump, .skip, .hint { display: none; } .rail { grid-auto-flow: row; grid-template-columns: repeat(2, 1fr); overflow: visible; margin: 0; padding: 0; } .card, .bundle, .panel, .tile { break-inside: avoid; } section { padding-block: 28px; } }
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
<meta name="theme-color" content="#E2E3DE">
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
    <a class="brand" href="#top"><img src="${markPlain}" width="36" height="36" alt=""><span><b>${esc(site.name)}</b><small>From the top</small></span></a>
    <a class="btn btn--primary btn--sm" href="${wa(BOOK_TEXT)}">${icon.whatsapp}Book</a>
  </div>
</header>

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
      <p class="eyebrow">Soweto Towers · Orlando Towers</p>
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

<section id="bundles" class="paper" aria-labelledby="bundles-title">
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

<section id="groups" class="paper" aria-labelledby="groups-title">
  <div class="wrap">
    <div class="head">
      <p class="eyebrow">Groups</p>
      <h2 id="groups-title">Bring the whole crew.</h2>
      <p class="lede">Birthdays, team days, school outings and tour groups. Thursdays and Fridays are the quietest days at the towers, which makes them the best days for groups.</p>
    </div>
    ${img(groups, { className: 'wide-img' })}
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
    ${img(visit, { className: 'wide-img' })}
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

<section id="questions" class="paper" aria-labelledby="questions-title">
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
      <p class="eyebrow" style="color:var(--coral)">Talk to the crew</p>
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
  <div class="wrap">
    <a class="brand" href="#top"><img src="${markPlain}" width="36" height="36" alt=""><span><b>${esc(site.name)}</b><small>Vertical Adventure Centre</small></span></a>
    <p>${esc(site.address.street)}, ${esc(site.address.suburb)}, ${esc(site.address.city)} · <a href="${SITE}/">sowetotowers.co.za</a></p>
    <p class="small">Prices in South African rand, per person, as of ${esc(formatDate(ymdInSast(new Date())))}. Prices and times can change, so please confirm when you book.</p>
    <p class="small">© ${year} ${esc(site.name)}. ${esc(site.hashtags.join(' '))}</p>
  </div>
</footer>
</body>
</html>
`;

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, html);
const total = (await stat(outFile)).size;
console.log(
  `${path.relative(process.cwd(), outFile)}  ${(total / 1024 / 1024).toFixed(2)} MB  (photos ${(imageBytes / 1024).toFixed(0)} KB as WebP, font ${(Buffer.from(font, 'base64').length / 1024).toFixed(0)} KB)`,
);
