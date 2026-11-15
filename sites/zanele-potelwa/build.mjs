#!/usr/bin/env node
/**
 * Zanele Potelwa — build the site from src/ into two pages.
 *
 *   index.html                    The hosted page. Photographs and fonts are
 *                                 separate files beside it, so the hero paints
 *                                 before the rest of the page has arrived and
 *                                 everything below the fold loads lazily.
 *   Zanele_Potelwa_Website.html   The same page folded into one file: every
 *                                 photograph and both fonts are written into
 *                                 it, so it opens from a WhatsApp attachment,
 *                                 an email or a phone's Files app with nothing
 *                                 alongside it. On iOS Quick Look there is no
 *                                 JavaScript either, so the template is built
 *                                 to read completely with scripts off.
 *
 * Every one of the 18 supplied images must appear exactly once. The build
 * fails if one is missing, used twice, or a token names something that does
 * not exist — an image cannot quietly drop out of the site.
 *
 *   {{include:styles.css}}          a file from src/, pasted in
 *   {{img:IMG_7884}}                src, width, height and alt, from images/manifest.json
 *   {{src:IMG_7884-tall}}           the address alone, for <source srcset>
 *   {{dims:IMG_7884-tall}}          its width and height attributes
 *   {{icon}}  {{fonts}}  {{head}}   home-screen icon, @font-face rules, host-dependent tags
 *   {{status:travel}}               a format's status label, from site.json
 *   {{events:upcoming}}  {{events:archive}}   the public fixture list, from site.json
 *   {{mailto:book}}  {{email}}      enquiry links that work with scripts off
 *   {{config}}                      what the page's scripts need from site.json
 *   <!-- format:travel --> … <!-- /format:travel -->
 *                                   dropped whole when that format is "hidden"
 *
 * Run:
 *   node sites/zanele-potelwa/build.mjs                    build both pages
 *   node sites/zanele-potelwa/build.mjs --masters <dir>    re-derive the images first
 *
 * --masters expects IMG_7876.png … IMG_7896.png (or .jpg/.jpeg) and needs
 * Python 3 + Pillow, as the app's own image scripts do.
 */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, 'src');
const IMAGES = path.join(here, 'images');
const FONTS = path.join(here, 'fonts');
const manifest = JSON.parse(readFileSync(path.join(IMAGES, 'manifest.json'), 'utf8'));
const site = JSON.parse(readFileSync(path.join(here, 'site.json'), 'utf8'));

// The masters are 1344 px wide at most, so nothing is scaled down: the JPEG
// quality is what sets the size. 85 keeps skin and the yellow-gold dress clean
// and the one-file page near 5 MB, which a phone opens from a chat.
const QUALITY = 85;
const OG_QUALITY = 86;

const fail = (why) => {
  console.error(why);
  process.exit(1);
};

/* ---------- Image derivatives ---------- */

const PY = String.raw`
import json, os, sys
from PIL import Image

masters, out, spec = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])

def master(image_id):
    for ext in ("png", "jpg", "jpeg", "PNG", "JPG", "JPEG"):
        p = os.path.join(masters, image_id + "." + ext)
        if os.path.exists(p):
            return Image.open(p).convert("RGB")
    sys.exit("Missing master: " + image_id)

def fit(im, width):
    if im.width <= width:
        return im
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)

def jpeg(im, name, quality):
    im.save(os.path.join(out, name), "JPEG", quality=quality, optimize=True,
            progressive=True, subsampling="4:2:0")

for item in spec["images"]:
    im = master(item["id"])
    if list(im.size) != item["master"]:
        sys.exit("%s is %s, manifest says %s" % (item["id"], im.size, item["master"]))
    jpeg(fit(im, item["width"]), item["id"] + ".jpg", spec["quality"])
    for v in item.get("variants", []):
        jpeg(fit(im.crop(tuple(v["crop"])), v["width"]), v["id"] + ".jpg", spec["quality"])

og = spec["og"]
im = master(og["from"]).crop(tuple(og["crop"])).resize(tuple(og["size"]), Image.LANCZOS)
jpeg(im, "og-image.jpg", spec["ogQuality"])

icon = spec["icon"]
square = master(icon["from"]).crop(tuple(icon["crop"]))
for name, size in icon["sizes"].items():
    square.resize((size, size), Image.LANCZOS).save(os.path.join(out, name + ".png"), "PNG", optimize=True)
`;

function derive(masters) {
  const spec = { ...manifest, quality: QUALITY, ogQuality: OG_QUALITY };
  execFileSync('python3', ['-I', '-c', PY, masters, IMAGES, JSON.stringify(spec)], {
    stdio: 'inherit',
  });
  console.log(`Derived ${manifest.images.length} images from ${masters}`);
}

const mastersFlag = process.argv.indexOf('--masters');
if (mastersFlag !== -1) {
  const masters = path.resolve(process.argv[mastersFlag + 1] ?? '');
  if (!existsSync(masters)) fail(`No masters directory at ${masters}`);
  derive(masters);
}

/** Width and height from a baseline or progressive JPEG's SOF marker. */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const length = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  throw new Error('No SOF marker');
}

const byId = new Map();
for (const image of manifest.images) {
  byId.set(image.id, image);
  for (const variant of image.variants ?? []) byId.set(variant.id, { ...image, ...variant });
}

const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const text = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dataUri = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;

/* ---------- site.json ---------- */

const base = site.siteUrl ? site.siteUrl.replace(/\/?$/, '/') : '';
const email = site.enquiries?.email ?? '';
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  fail('site.json enquiries.email must be the address that receives bookings and briefs');
}

// The brief's CMS statuses. A format is only ever "active" once Zanele has
// approved its name, format, rights and launch timing.
const STATUS = {
  concept: 'Concept',
  'in development': 'In development',
  pilot: 'Pilot season',
  active: 'Now showing',
  paused: 'Paused',
  archived: 'Archived',
};
const formats = site.formats ?? {};
for (const [slug, status] of Object.entries(formats)) {
  if (status !== 'hidden' && !STATUS[status]) {
    fail(
      `site.json formats.${slug} is "${status}"; use one of: ${Object.keys(STATUS).join(', ')}, hidden`,
    );
  }
}

function status(slug) {
  const value = formats[slug];
  if (!value) fail(`{{status:${slug}}} names no format in site.json`);
  const cls = value.replace(/\s+/g, '-');
  return `<span class="status status--${cls}">${STATUS[value]}</span>`;
}

/* ---------- Events: only what is approved for public release ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EVENT_STATUS = ['scheduled', 'postponed', 'rescheduled', 'cancelled', 'completed'];
// South Africa keeps UTC+2 all year, so local times need no daylight rules.
const SAST = '+02:00';

function when(start) {
  const m = /^(\d{4})(?:-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?)?$/.exec(start ?? '');
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  if (!mo) return { precision: 'year', datetime: y, day: y, month: '' };
  return {
    precision: hh ? 'time' : 'day',
    datetime: hh ? `${y}-${mo}-${d}T${hh}:${mm}${SAST}` : `${y}-${mo}-${d}`,
    day: String(Number(d)),
    month: `${MONTHS[Number(mo) - 1]} ${y}`,
    clock: hh ? `${hh}:${mm} SAST` : '',
  };
}

const icsStamp = (date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const icsText = (s) => String(s).replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');

/** A calendar file for one event, as a link the visitor can save. */
function ics(event, at) {
  if (at.precision !== 'time') return '';
  const start = new Date(at.datetime);
  const endAt = event.end ? when(event.end) : null;
  const end = endAt?.precision === 'time' ? new Date(endAt.datetime) : new Date(+start + 2 * 3600e3);
  const uid = `${event.title}-${at.datetime}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zanele Potelwa//Public events//EN',
    'BEGIN:VEVENT',
    `UID:${uid}@zanele-potelwa`,
    // Stamped with the event's own start, so the same site.json always builds the same file.
    `DTSTAMP:${icsStamp(start)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsText(event.title)}`,
    `LOCATION:${icsText([event.venue, event.city].filter(Boolean).join(', '))}`,
    event.url ? `URL:${event.url}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}

function eventRow(event) {
  const at = when(event.start);
  if (!event.title || !at) fail(`site.json events: "${event.title ?? '?'}" needs a title and a start`);
  const state = event.status ?? 'scheduled';
  if (!EVENT_STATUS.includes(state)) fail(`site.json events: "${event.title}" has status "${state}"`);
  if (event.url && !/^https:\/\//.test(event.url)) fail(`site.json events: "${event.title}" url must be https`);
  const where = [event.venue, event.city, event.role, at.clock].filter(Boolean).map(text).join(' · ');
  const flag =
    state === 'scheduled' || state === 'completed'
      ? ''
      : ` <span class="status status--${state}">${state[0].toUpperCase()}${state.slice(1)}</span>`;
  const links = [];
  if (event.url && state !== 'cancelled') {
    links.push(
      `<a class="link" href="${attr(event.url)}" target="_blank" rel="noopener">${text(event.action ?? 'Details')} <span aria-hidden="true">↗&#xFE0E;</span></a>`,
    );
  }
  const calendar = state === 'scheduled' ? ics(event, at) : '';
  if (calendar) links.push(`<a class="link" href="${calendar}" download="zanele-potelwa-event.ics">Add to calendar</a>`);
  return [
    '<li class="event">',
    `  <time datetime="${at.datetime}"><span class="d${at.precision === 'year' ? ' d--year' : ''}">${at.day}</span>${at.month ? `<span class="m">${at.month}</span>` : ''}</time>`,
    `  <div><strong>${text(event.title)}</strong>${flag}<span class="where">${where}</span>${event.note ? `<span class="where">${text(event.note)}</span>` : ''}${links.length ? `<span class="event-links">${links.join('')}</span>` : ''}</div>`,
    '</li>',
  ].join('\n');
}

function events(kind) {
  const all = site.events ?? [];
  const list = all.filter((e) => ((e.status ?? 'scheduled') === 'completed') === (kind === 'archive'));
  if (kind === 'upcoming') {
    const today = new Date().toISOString().slice(0, 10);
    for (const e of list) {
      if ((e.status ?? 'scheduled') === 'scheduled' && /^\d{4}-\d{2}-\d{2}/.test(e.start) && e.start.slice(0, 10) < today) {
        console.warn(`site.json events: "${e.title}" is scheduled in the past — mark it completed`);
      }
    }
    if (!list.length) {
      return [
        '<p class="big-note">No public dates are listed yet.</p>',
        '<p>Appearances are published here once they are confirmed and approved for public release. Private engagements are never listed.</p>',
      ].join('\n');
    }
  }
  if (!list.length) return '';
  return `<ol class="events">\n${list.map(eventRow).join('\n')}\n</ol>`;
}

/* ---------- Enquiry links that work without scripts ---------- */

const MAILTO = {
  book: {
    subject: 'Booking request — Zanele Potelwa',
    body: [
      'Role requested (MC, awards host, moderator, launch host, speaker):',
      'Event name and type:',
      'Date and start time:',
      'Venue, city and country:',
      'Expected audience:',
      'Organiser and your name:',
      'Phone:',
      'Budget range:',
      'Format, languages, travel and recording notes:',
      '',
      'I understand that sending this request does not reserve the date.',
    ],
  },
  brief: {
    subject: 'Partnership brief — Zanele Potelwa',
    body: [
      'Brand or company:',
      'Category:',
      'Partnership in mind (paid pilot, seasonal programme, annual partnership):',
      'Objective:',
      'Target audience and territory:',
      'Campaign timing:',
      'Deliverables in mind:',
      'Usage rights and exclusivity needed:',
      'Budget range:',
      'Your name, role and phone:',
    ],
  },
  community: {
    subject: 'Join the community — Zanele Potelwa',
    body: [
      'Please add me to the community list.',
      '',
      'Name:',
      'Email updates (yes / no):',
      'WhatsApp updates (yes / no) and number:',
      '',
      'I am opting in to new-episode alerts, selected public events and approved updates. I can opt out at any time.',
    ],
  },
  press: {
    subject: 'Media kit request — Zanele Potelwa',
    body: ['Publication or programme:', 'What you are working on:', 'Deadline:', 'Your name and phone:'],
  },
  general: { subject: 'Enquiry — Zanele Potelwa', body: [] },
};

function mailto(kind) {
  const m = MAILTO[kind];
  if (!m) fail(`{{mailto:${kind}}} is not a known enquiry`);
  const query = [`subject=${encodeURIComponent(m.subject)}`];
  if (m.body.length) query.push(`body=${encodeURIComponent(m.body.join('\r\n'))}`);
  return attr(`mailto:${email}?${query.join('&')}`);
}

/* ---------- Tags that depend on where the page is hosted ---------- */

/**
 * Link previews (WhatsApp, iMessage, Slack) only fetch an absolute http(s)
 * image URL, never a data: URI, so the share image is the one file that has to
 * live somewhere public whichever page is shared.
 */
function head(mode) {
  const image = site.ogImageUrl || (base && `${base}images/og-image.jpg`);
  const tags = [];
  if (base) tags.push(`<meta property="og:url" content="${attr(base)}">`);
  if (image) {
    tags.push(
      `<meta property="og:image" content="${attr(image)}">`,
      `<meta property="og:image:secure_url" content="${attr(image)}">`,
      '<meta property="og:image:type" content="image/jpeg">',
      `<meta property="og:image:width" content="${manifest.og.size[0]}">`,
      `<meta property="og:image:height" content="${manifest.og.size[1]}">`,
      `<meta property="og:image:alt" content="${attr(manifest.og.alt)}">`,
      `<meta name="twitter:image" content="${attr(image)}">`,
      `<meta name="twitter:image:alt" content="${attr(manifest.og.alt)}">`,
    );
  } else {
    console.warn('site.json has no siteUrl or ogImageUrl: links will share without a picture');
  }
  // A review preview must not compete with an official site in search.
  if (!site.indexable) tags.push('<meta name="robots" content="noindex">');
  else if (base) tags.push(`<link rel="canonical" href="${attr(base)}">`);
  if (mode === 'web') {
    // The hero is the largest thing on the first screen: fetch it first, and
    // only the crop this screen will actually show.
    const tall = '(orientation: portrait) and (max-width: 1100px)';
    tags.push(
      `<link rel="preload" as="image" href="images/IMG_7884-tall.jpg" media="${tall}" fetchpriority="high">`,
      `<link rel="preload" as="image" href="images/IMG_7884.jpg" media="not all and ${tall}" fetchpriority="high">`,
      '<link rel="preload" as="font" type="font/woff2" href="fonts/fraunces-latin-opsz-normal.woff2" crossorigin>',
      '<link rel="manifest" href="manifest.webmanifest">',
      '<link rel="icon" type="image/png" sizes="192x192" href="images/icon-192.png">',
    );
  }
  return tags.join('\n  ');
}

function fonts(mode) {
  const face = (style, file) => {
    const url =
      mode === 'web' ? `fonts/${file}` : dataUri(path.join(FONTS, file), 'font/woff2');
    return `@font-face { font-family: "Fraunces"; font-style: ${style}; font-weight: 100 900; font-display: swap; src: url("${url}") format("woff2"); }`;
  };
  return [
    face('normal', 'fraunces-latin-opsz-normal.woff2'),
    face('italic', 'fraunces-latin-opsz-italic.woff2'),
  ].join('\n    ');
}

function config() {
  const value = { email, consent: site.enquiries.consentVersion ?? '', url: base };
  // Inside a <script>: never let a value close the element early.
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/* ---------- Render ---------- */

function load(id, mode) {
  const file = path.join(IMAGES, `${id}.jpg`);
  if (!existsSync(file)) fail(`${file} is missing — run with --masters first`);
  const buf = readFileSync(file);
  const uri = mode === 'web' ? `images/${id}.jpg` : `data:image/jpeg;base64,${buf.toString('base64')}`;
  return { ...jpegSize(buf), uri };
}

function render(mode) {
  let html = readFileSync(path.join(SRC, 'index.html'), 'utf8');
  html = html.replace(/\{\{include:([\w.-]+)\}\}/g, (_, file) =>
    readFileSync(path.join(SRC, file), 'utf8').trimEnd(),
  );

  // A hidden format leaves the page whole, with its photograph held back.
  const held = new Set();
  html = html.replace(
    /[ \t]*<!-- format:([\w-]+) -->([\s\S]*?)<!-- \/format:\1 -->\n?/g,
    (block, slug, inner) => {
      if (!(slug in formats)) fail(`<!-- format:${slug} --> names no format in site.json`);
      if (formats[slug] !== 'hidden') return inner.replace(/^\n/, '');
      for (const m of inner.matchAll(/\{\{(?:img|src):([\w-]+)\}\}/g)) held.add(m[1]);
      return '';
    },
  );

  const used = new Map();
  html = html.replace(
    /\{\{(img|src|dims|status|events|mailto):([\w-]+)\}\}|\{\{(icon|fonts|head|config|email)\}\}/g,
    (token, kind, id, name) => {
      if (name === 'head') return head(mode);
      if (name === 'fonts') return fonts(mode);
      if (name === 'config') return config();
      if (name === 'email') return text(email);
      if (name === 'icon') {
        return mode === 'web'
          ? 'images/apple-touch-icon.png'
          : dataUri(path.join(IMAGES, 'apple-touch-icon.png'), 'image/png');
      }
      if (kind === 'status') return status(id);
      if (kind === 'events') return events(id);
      if (kind === 'mailto') return mailto(id);
      const image = byId.get(id);
      if (!image) fail(`${token} names no image in the manifest`);
      const { width, height, uri } = load(id, mode);
      if (kind === 'dims') return `width="${width}" height="${height}"`;
      used.set(id, (used.get(id) ?? 0) + 1);
      if (kind === 'src') return uri;
      return `src="${uri}" width="${width}" height="${height}" alt="${attr(image.alt)}"`;
    },
  );

  const stray = html.match(/\{\{[^{}\n]{1,60}\}\}/);
  if (stray) fail(`Unknown token in the template: ${stray[0]}`);

  const problems = [];
  for (const id of byId.keys()) {
    if (held.has(id)) continue;
    const n = used.get(id) ?? 0;
    if (n !== 1) problems.push(`${id} is used ${n} times (want exactly 1)`);
  }
  if (problems.length) fail(problems.join('\n'));
  return { html, held };
}

const webManifest = {
  name: 'Zanele Potelwa — The People’s Champion',
  short_name: 'Zanele',
  description:
    'Television, radio, live hosting and original content from South African presenter Zanele Potelwa.',
  lang: 'en-ZA',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#0b3b2e',
  theme_color: '#0b3b2e',
  icons: [
    { src: 'images/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'images/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
};
writeFileSync(path.join(here, 'manifest.webmanifest'), `${JSON.stringify(webManifest, null, 2)}\n`);

const outputs = [
  ['web', 'index.html', 'photographs and fonts beside it'],
  ['file', 'Zanele_Potelwa_Website.html', 'everything inline'],
];
for (const [mode, name, how] of outputs) {
  const { html, held } = render(mode);
  const out = path.join(here, name);
  writeFileSync(out, html);
  const size = Buffer.byteLength(html);
  const shown = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` : `${Math.round(size / 1024)} KB`;
  console.log(`Wrote ${path.relative(process.cwd(), out)} — ${shown}, ${how}`);
  if (held.size) console.log(`  held back with hidden formats: ${[...held].join(', ')}`);
}
console.log(`Enquiries go to ${email}. Formats: ${Object.entries(formats).map(([k, v]) => `${k} = ${v}`).join('; ')}.`);
