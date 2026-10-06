// Builds the downloadable, single-file edition of the site:
//   dist/andile-ncube.html — every image, font and line of metadata inside.
//
// Run from andile-ncube/:  npm run standalone
//
// Content comes from the same data/*.ts modules the Next.js site renders, so
// the two never drift. Each photograph is lightly enhanced (levels, contrast,
// colour, clarity), re-encoded as WebP, and given embedded EXIF + XMP metadata
// (title, description/alt text, keywords) before being inlined.

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const load = (m) => import(path.join(root, "data", m));

const { media } = await load("media.ts");
const { episodes, multiplierItems, episodeLabel } = await load("episodes.ts");
const { sponsorCategories } = await load("sponsors.ts");
const { stories } = await load("stories.ts");
const { headshots, pressPhotographs } = await load("press.ts");
const { opportunities, budgetRanges, objectives } = await load("enquiry.ts");
const { site } = await load("site.ts");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ascii = (s) => s.replace(/[—–]/g, "-").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7e]/g, "");

/* ------------------------------------------------------------------ icons */
const icon = (d, cls = "") => `<svg ${cls ? `class="${cls}" ` : ""}viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  ICON_ARROW: icon('<path d="M5 12h14M13 6l6 6-6 6"/>', "go"),
  ICON_LEFT: icon('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
  ICON_RIGHT: icon('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  ICON_DOWN: icon('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  ICON_X: icon('<path d="M18 6 6 18M6 6l12 12"/>'),
  ICON_PLAY: icon('<path d="M7 4.5v15l12-7.5z"/>'),
  ICON_CHECK: icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  ICON_PLUS: icon('<path d="M12 5v14M5 12h14"/>'),
  ICON_CLIP: icon('<path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/>'),
};

/* ------------------------------------------------------------------ images */
const xmpPacket = (a) => `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/">
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(`${a.id} — ${a.role}`)}</rdf:li></rdf:Alt></dc:title>
<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${esc(a.alt)}</rdf:li></rdf:Alt></dc:description>
<Iptc4xmpCore:AltTextAccessibility><rdf:Alt><rdf:li xml:lang="x-default">${esc(a.alt)}</rdf:li></rdf:Alt></Iptc4xmpCore:AltTextAccessibility>
<dc:subject><rdf:Bag><rdf:li>Andile Ncube</rdf:li><rdf:li>The House That Andile Built</rdf:li><rdf:li>${esc(a.role)}</rdf:li></rdf:Bag></dc:subject>
<dc:identifier>${esc(a.id)}</dc:identifier>
<photoshop:Headline>${esc(a.role)}</photoshop:Headline>
</rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`;

const MAX_WIDTH = 1920;
const images = {};
let rawBytes = 0;
for (const a of Object.values(media)) {
  const file = path.join(root, "public", a.src);
  const buf = await sharp(file)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    // Enhancement, deliberately light: a gentle levels stretch that leaves the
    // shadows alone, a touch of contrast and colour, then fine-detail clarity.
    .normalise({ lower: 0.05, upper: 99.7 })
    .linear(1.04, -128 * 0.04)
    .modulate({ saturation: 1.03 })
    .sharpen({ sigma: 0.7, m1: 0.5, m2: 1.4 })
    .withExif({ IFD0: { ImageDescription: ascii(a.alt), Software: "andile-ncube standalone build", DocumentName: `${a.id} - ${ascii(a.role)}` } })
    .withXmp(xmpPacket(a))
    .webp({ quality: 80, effort: 6, smartSubsample: true })
    .toBuffer();
  rawBytes += buf.length;
  images[a.id] = `data:image/webp;base64,${buf.toString("base64")}`;
}

/* ------------------------------------------------------------------ markup helpers */
// {{img ID [eager] [decorative] focus="x y" alt="…" class="…"}}
function imgTag(id, opts = {}) {
  const a = media[id];
  if (!a) throw new Error(`Unknown image ${id}`);
  const alt = opts.decorative ? "" : opts.alt ?? a.alt;
  return `<img data-img="${id}"${opts.eager ? " data-eager" : ""} alt="${esc(alt)}" width="${a.width}" height="${a.height}" draggable="false" style="object-position:${opts.focus ?? a.focus}"${opts.class ? ` class="${opts.class}"` : ""}>`;
}
const pad = (n) => String(n).padStart(2, "0");

const episodeCards = episodes
  .map(
    (e) => `<li class="w-ep"><button class="card" data-episode="${e.slug}" data-label="${esc(episodeLabel(e))}" aria-label="${esc(`${episodeLabel(e)} — title to be confirmed. Open episode`)}">
  <div class="media r-169">${imgTag(e.poster, { decorative: true })}<span class="play">${ICONS.ICON_PLAY}</span></div>
  <div class="row"><p class="meta muted">${esc(episodeLabel(e))}</p>${e.status !== "published" ? '<span class="tag">Placeholder</span>' : ""}</div>
  <h3 class="display" style="font-size:1.5rem;line-height:1">${esc(e.title ?? "Title to be confirmed")}</h3></button></li>`,
  )
  .join("\n");

const multiplier = multiplierItems
  .map(
    (m, i) => `<li class="${m.orientation === "portrait" ? "w-port" : "w-land"}"><figure><div class="media ${m.orientation === "portrait" ? "r-916" : "r-169"}">${imgTag(m.image, { decorative: true })}</div><figcaption class="meta muted" style="margin-top:.75rem;display:flex;justify-content:space-between"><span>${esc(m.kind)}</span><span aria-hidden="true">${pad(i + 1)}</span></figcaption></figure></li>`,
  )
  .join("\n");

const sponsorTabs = sponsorCategories
  .map(
    (c, i) => `<button role="tab" id="sp-tab-${i}" aria-controls="sp-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><span class="meta" style="width:1.5rem;flex:none">${pad(i + 1)}</span><span><span class="display name">${esc(c.name)}</span><span class="meta" style="display:block;margin-top:.5rem">${esc(c.role)}</span></span></button>`,
  )
  .join("");

const sponsorCards = sponsorCategories
  .map(
    (c, i) => `<li class="w-sp"><article class="spcard light"><div class="media r-43">${imgTag(c.images[0])}<span class="meta num">${pad(i + 1)}</span></div><div class="in"><p class="meta muted">${esc(c.role)}</p><h3 class="display t-card" style="margin-top:.5rem">${esc(c.name)}</h3><p class="serif" style="margin-top:.5rem;font-size:1.2rem">${esc(c.summary)}</p>
  <button class="meta toggle" aria-expanded="false" aria-controls="spd-${i}"><span class="lbl">Why it fits, inventory &amp; more</span>${ICONS.ICON_PLUS}</button>
  <div class="details" id="spd-${i}"><div><div class="blocks-host" style="padding-top:1.5rem"></div></div></div></div></article></li>`,
  )
  .join("\n");

const storyCards = stories
  .map(
    (s) => `<li data-cat="${esc(s.category)}"><button class="card" data-story="${s.slug}" data-cat="${esc(s.category)}"><div class="media r-43">${imgTag(s.cover, { decorative: true })}</div><div class="row"><p class="meta muted">${esc(s.category)}</p>${s.status !== "published" ? '<span class="tag">Draft — for approval</span>' : ""}</div><h3 class="display t-card">${esc(s.title)}</h3><p class="excerpt">${esc(s.excerpt)}</p></button></li>`,
  )
  .join("\n");

const photo = (id, ratio) => {
  const a = media[id];
  const ext = "webp";
  return `<li><a href="#" data-download="${id}" download="Andile-Ncube-${id}.${ext}"><div class="media ${ratio}">${imgTag(id)}</div><span class="cap"><span>${id} · WebP · ${Math.min(a.width, MAX_WIDTH)}px</span>${ICONS.ICON_DOWN}<span class="sr-only">Download</span></span></a></li>`;
};
const headshotList = headshots.map((id) => photo(id, "r-45")).join("");
const pressList = pressPhotographs.map((id) => photo(id, "r-43")).join("");

const choice = (type, name, value, label) =>
  `<label class="choice ${type}"><input type="${type}" name="${name}" value="${value}"><span class="box">${ICONS.ICON_CHECK}</span><span class="meta">${esc(label)}</span></label>`;
const err = (k) => `<p class="err" id="e-${k}" hidden></p>`;
const field = (label, name, attrs = "", optional = false) =>
  `<div class="field"><label for="f-${name}">${esc(label)}${optional ? '<span class="opt">(optional)</span>' : ""}</label><input id="f-${name}" name="${name}" ${attrs} aria-describedby="e-${name}">${err(name)}</div>`;

const steps = [
  `<fieldset class="fields" style="border:0;padding:0;margin:0" aria-describedby="e-opportunity"><legend class="sr-only">Opportunity</legend><div class="choices two">${opportunities.map((o) => choice("radio", "opportunity", o.value, o.label)).join("")}</div>${err("opportunity")}</fieldset>
   <div class="field" id="cat-wrap" hidden style="margin-top:1.5rem"><label for="f-cat">Sponsor category<span class="opt">(optional)</span></label><select id="f-cat" name="sponsorCategory"><option value="">Not sure yet</option>${sponsorCategories.map((c) => `<option value="${c.slug}">${esc(`${c.name} — ${c.role}`)}</option>`).join("")}</select></div>`,
  `<div class="fields">${field("Company name", "company", 'autocomplete="organization"')}${field("Website", "website", 'inputmode="url" autocomplete="url" placeholder="company.co.za"', true)}</div>`,
  `<div class="fields two-col">${field("Your name", "contactName", 'autocomplete="name"')}${field("Role", "role", 'autocomplete="organization-title"', true)}${field("Work email", "email", 'type="email" autocomplete="email"')}${field("Phone", "phone", 'type="tel" autocomplete="tel"', true)}</div>`,
  `<fieldset class="fields" style="border:0;padding:0;margin:0" aria-describedby="e-budget"><legend class="sr-only">Budget range</legend><div class="choices">${budgetRanges.map((b) => choice("radio", "budget", b.value, b.label)).join("")}</div><p class="hint">Used only to route your enquiry. It is not a quote or a rate.</p>${err("budget")}</fieldset>`,
  `<fieldset class="fields" style="border:0;padding:0;margin:0" aria-describedby="e-objectives"><legend class="meta muted">Choose all that apply</legend><div class="choices two">${objectives.map((o) => choice("checkbox", "objectives", o.value, o.label)).join("")}</div>${err("objectives")}</fieldset>`,
  `<div class="fields"><div class="field"><label for="f-message">Your message</label><p class="hint" id="h-message">The brand, the audience you want to reach, timing, and anything already decided.</p><textarea id="f-message" name="message" maxlength="4000" aria-describedby="h-message e-message"></textarea>${err("message")}</div></div>`,
  `<div class="fields"><div class="field"><p class="label">Brief<span class="opt">(optional)</span></p><p class="hint" id="h-file">PDF, Word (.docx) or PowerPoint (.pptx), up to 10 MB.</p>
     <label class="drop" id="file-drop">${ICONS.ICON_CLIP}<span class="meta">Choose a file</span><input type="file" name="attachment" accept=".pdf,.docx,.pptx" aria-describedby="h-file e-attachment"></label>
     <div class="filechip" id="file-chip" hidden><span style="display:flex;gap:.75rem;align-items:center;min-width:0">${ICONS.ICON_CLIP}<span id="file-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span><span class="meta muted" id="file-size"></span></span><button type="button" id="file-remove" style="width:2.75rem;height:2.75rem;display:inline-flex;align-items:center;justify-content:center" aria-label="Remove file">${ICONS.ICON_X}</button></div>${err("attachment")}</div>
     <div><label class="consent"><input type="checkbox" name="consent" value="yes" aria-describedby="e-consent"><span>I agree that the details in this enquiry may be used to respond to it.</span></label>${err("consent")}</div></div>`,
];
const stepTitles = [
  "What would you like to build together?",
  "Which company is this for?",
  "Who should we speak to?",
  "What budget range are you working with?",
  "What should the partnership achieve?",
  "Tell us about the idea.",
  "Attach a brief, if you have one.",
];
const stepsHtml = steps
  .map((body, i) => `<div class="step"${i ? " hidden" : ""}><h3 class="display t-card" tabindex="-1"${i === 0 ? ' id="step-q"' : ""}>${stepTitles[i]}</h3>${body}</div>`)
  .join("\n");

/* ------------------------------------------------------------------ sheet content */
const episodeTemplates = episodes
  .map(
    (e) => `<template id="tpl-${e.slug}"><div class="media r-169" style="margin-top:.5rem">${imgTag(e.poster)}<div style="position:absolute;inset:0;display:flex;align-items:flex-end;padding:1.5rem;background:linear-gradient(to top,rgba(10,10,10,.9),transparent)"><span><span class="meta" style="color:var(--stone);display:block">Not yet published</span><span class="muted" style="display:block;margin-top:.5rem;font-size:.95rem">Video will play here when the episode is released.</span></span></div></div>
  <div style="margin-top:1.5rem;display:flex;gap:.75rem;align-items:center;flex-wrap:wrap"><p class="meta muted">${esc(site.property)} · ${esc(episodeLabel(e))}</p><span class="tag">Placeholder</span></div>
  <h2 class="display" id="sheet-title" style="margin-top:1rem;font-size:clamp(2.25rem,1.6rem + 2.6vw,4rem);line-height:.9">${esc(e.title ?? "Title to be confirmed")}</h2>
  <dl><div><dt>Release</dt><dd>${esc(e.releaseDate ?? "To be confirmed")}</dd></div><div><dt>Runtime</dt><dd>To be confirmed</dd></div></dl>
  <p class="muted" style="margin-top:1.5rem">${esc(e.summary)}</p>
  <section><h3 class="meta" style="color:var(--stone)">Behind the build</h3><p class="muted" style="margin-top:.75rem">${esc(e.behindTheBuild)}</p></section>
  <section><h3 class="meta" style="color:var(--stone)">Key moments</h3><ol class="moments" style="margin-top:.75rem;border-top:1px solid rgba(242,239,232,.15)">${e.keyMoments.map((m, i) => `<li><span>${esc(m.label)} ${pad(i + 1)}</span><span class="meta muted">${m.timestamp ?? "—"}</span></li>`).join("")}</ol><p class="muted" style="margin-top:.75rem;font-size:.9rem">Timestamps are added when the episode is published.</p></section>
  <section><h3 class="meta" style="color:var(--stone)">Shorts</h3><ul class="shorts">${e.shorts.map((s, i) => `<li><div class="media r-916">${imgTag(s.image, { decorative: true })}</div><p class="meta muted" style="margin-top:.5rem">Short ${pad(i + 1)} — placeholder</p></li>`).join("")}</ul></section>
  <div style="margin-top:2.5rem"><a class="btn btn-solid" href="#enquire" data-opportunity="sponsor-flagship" data-track="partnership_start" data-source="episode" onclick="document.getElementById('sheet').close()">Sponsor the Flagship ${ICONS.ICON_ARROW}</a></div></template>`,
  )
  .join("\n");
const storyTemplates = stories
  .map(
    (s) => `<template id="tpl-${s.slug}"><article class="article"><div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;margin-top:.5rem"><p class="meta muted">${esc(s.category)}</p>${s.status !== "published" ? '<span class="tag">Draft — for approval</span>' : ""}</div>
  <h2 class="display" id="sheet-title" style="margin-top:1rem;font-size:clamp(2.5rem,1.6rem + 3.6vw,5rem);line-height:.9">${esc(s.title)}</h2>
  <p class="serif lede" style="margin-top:1.25rem">${esc(s.excerpt)}</p>
  <div class="media r-169" style="margin-top:2rem">${imgTag(s.cover)}</div>
  <div style="max-width:40rem">${s.body.map((p) => `<p>${esc(p)}</p>`).join("")}</div></article></template>`,
  )
  .join("\n");

/* ------------------------------------------------------------------ metadata */
const buildDate = new Date().toISOString().slice(0, 10);
let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
} catch {}
const imageObjects = Object.values(media).map((a) => ({
  "@type": "ImageObject",
  "@id": `#${a.id}`,
  name: `${a.id} — ${a.role}`,
  caption: a.alt,
  description: a.role,
  encodingFormat: "image/webp",
  width: Math.min(a.width, MAX_WIDTH),
  height: Math.round(a.height * (Math.min(a.width, MAX_WIDTH) / a.width)),
  keywords: ["Andile Ncube", site.property, a.role],
}));
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": "#website", name: site.name, description: site.description, inLanguage: "en-ZA" },
    {
      "@type": "WebPage",
      "@id": "#webpage",
      name: `${site.name} — ${site.property}`,
      description: site.description,
      isPartOf: { "@id": "#website" },
      about: { "@id": "#andile" },
      primaryImageOfPage: { "@id": "#IMG_6889" },
      dateModified: buildDate,
      inLanguage: "en-ZA",
    },
    { "@type": "Person", "@id": "#andile", name: site.name, jobTitle: "Broadcaster, host and storyteller", image: { "@id": "#IMG_6910" } },
    { "@type": "Organization", "@id": "#house", name: site.property, founder: { "@id": "#andile" }, description: site.description },
    { "@type": "ImageGallery", "@id": "#library", name: "Image library", associatedMedia: imageObjects },
  ],
};
const buildInfo = {
  edition: "downloadable",
  built: buildDate,
  sourceCommit: commit,
  images: Object.keys(media).length,
  imageProcessing: "levels (0.05–99.7 pct), contrast 1.04, saturation 1.03, unsharp (σ 0.7); WebP q80; EXIF + XMP embedded",
  fonts: ["Archivo (SIL OFL 1.1)", "Instrument Serif (SIL OFL 1.1)"],
  enquiry: "Not connected — set ENQUIRY_ENDPOINT in the page script to send enquiries.",
};
const imageMeta = Object.fromEntries(Object.values(media).map((a) => [a.id, { alt: a.alt, focus: a.focus, role: a.role }]));
const sponsorsJson = sponsorCategories.map((c) => ({ ...c, image: c.images[0] }));

/* ------------------------------------------------------------------ assemble */
const font = (f) => readFileSync(path.join(here, "fonts", f)).toString("base64");
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
const tokens = {
  ...ICONS,
  FONT_ARCHIVO: font("archivo.woff2"),
  FONT_INSTRUMENT: font("instrument.woff2"),
  FONT_INSTRUMENT_ITALIC: font("instrument-italic.woff2"),
  JSON_LD: json(jsonLd),
  BUILD_INFO: json(buildInfo),
  BUILD_DATE: buildDate,
  EPISODE_CARDS: episodeCards,
  MULTIPLIER_ITEMS: multiplier,
  SPONSOR_TABS: sponsorTabs,
  SPONSOR_CARDS: sponsorCards,
  STORY_CARDS: storyCards,
  HEADSHOTS: headshotList,
  PRESS_PHOTOS: pressList,
  STEPS: stepsHtml,
  TEMPLATES: episodeTemplates + "\n" + storyTemplates,
  IMAGES: json(images),
  IMAGE_META: json(imageMeta),
  SPONSORS_JSON: json(sponsorsJson),
};

let html = readFileSync(path.join(here, "template.html"), "utf8");
// Image placeholders first: {{img ID flags key="value"}}
html = html.replace(/\{\{img (\w+)([^}]*)\}\}/g, (_, id, rest) => {
  const opts = {};
  for (const [, k, v] of rest.matchAll(/(\w+)="([^"]*)"/g)) opts[k] = v;
  const flags = rest.replace(/(\w+)="[^"]*"/g, "");
  if (/\beager\b/.test(flags)) opts.eager = true;
  if (/\bdecorative\b/.test(flags)) opts.decorative = true;
  return imgTag(id, opts);
});
// Fragments may contain icon tokens of their own, so substitute twice.
for (let pass = 0; pass < 2; pass++) html = html.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m));
const left = html.match(/\{\{[^}]+\}\}/g);
if (left) throw new Error(`Unfilled placeholders: ${[...new Set(left)].join(", ")}`);

mkdirSync(path.join(here, "dist"), { recursive: true });
const out = path.join(here, "dist", "andile-ncube.html");
writeFileSync(out, html);
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`Wrote ${path.relative(root, out)} — ${kb(Buffer.byteLength(html))} (${Object.keys(images).length} images, ${kb(rawBytes)} before base64)`);
