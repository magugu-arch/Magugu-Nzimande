#!/usr/bin/env node
/**
 * Thandiswa Mazwai — fold the site into one self-contained HTML file.
 *
 * The page has to open from a WhatsApp attachment, an email or a phone's
 * Files app, where there is no server to fetch anything from and, on iOS
 * Quick Look, no JavaScript either. So every photograph is written straight
 * into its <img src> as a data: URI — not swapped in by a script — and the
 * template is built to read completely with scripts off.
 *
 * Every one of the 22 supplied images must appear exactly once. Each image's
 * bytes are in the file only once that way; the lightbox reuses the same src
 * rather than embedding a second copy. The build fails if one is missing,
 * used twice, or a token names something that does not exist.
 *
 *   {{img:IMG_7145}}   src, width, height and alt, from images/manifest.json
 *   {{src:IMG_7137-portrait}}   the data: URI alone, for <source srcset>
 *   {{icon}}           the home-screen icon
 *   {{social}}         the meta tags that need an absolute URL (see site.json)
 *
 * Run:
 *   node sites/thandiswa-mazwai/build.mjs                    inline only
 *   node sites/thandiswa-mazwai/build.mjs --masters <dir>    re-derive images first
 *
 * --masters expects IMG_7137.png … IMG_7158.png (or .jpg/.jpeg) and needs
 * Python 3 + Pillow, as the app's own image scripts do.
 */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const IMAGES = path.join(here, 'images');
const manifest = JSON.parse(readFileSync(path.join(IMAGES, 'manifest.json'), 'utf8'));
const site = JSON.parse(readFileSync(path.join(here, 'site.json'), 'utf8'));

// Dark stage photography bands in smooth gradients below about 74; this keeps
// the whole page near 6 MB, which a phone opens from a chat without stalling.
const QUALITY = 76;
const OG_QUALITY = 84;

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
im = master(icon["from"]).crop(tuple(icon["crop"])).resize((icon["size"],) * 2, Image.LANCZOS)
im.save(os.path.join(out, "apple-touch-icon.png"), "PNG", optimize=True)
`;

function derive(masters) {
  const spec = { ...manifest, quality: QUALITY, ogQuality: OG_QUALITY };
  execFileSync('python3', ['-c', PY, masters, IMAGES, JSON.stringify(spec)], {
    stdio: 'inherit',
  });
  console.log(`Derived ${manifest.images.length} images from ${masters}`);
}

const mastersFlag = process.argv.indexOf('--masters');
if (mastersFlag !== -1) {
  const masters = path.resolve(process.argv[mastersFlag + 1] ?? '');
  if (!existsSync(masters)) {
    console.error(`No masters directory at ${masters}`);
    process.exit(2);
  }
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

function load(id) {
  const file = path.join(IMAGES, `${id}.jpg`);
  if (!existsSync(file)) throw new Error(`${file} is missing — run with --masters first`);
  const buf = readFileSync(file);
  return { ...jpegSize(buf), uri: `data:image/jpeg;base64,${buf.toString('base64')}` };
}

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/**
 * The tags that depend on where the page is hosted. Link previews (WhatsApp,
 * iMessage, Slack) only fetch an absolute http(s) image URL, never a data: URI,
 * so the share image is the one file that has to live somewhere public.
 */
function social() {
  const base = site.siteUrl ? site.siteUrl.replace(/\/?$/, '/') : '';
  const image = site.ogImageUrl || (base && `${base}og-image.jpg`);
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
  // A review preview must not compete with the official site in search.
  if (!site.indexable) tags.push('<meta name="robots" content="noindex">');
  else if (base) tags.push(`<link rel="canonical" href="${attr(base)}">`);
  return tags.join('\n  ');
}

const used = new Map();
const template = readFileSync(path.join(here, 'src', 'index.html'), 'utf8');
const html = template.replace(
  /\{\{(img|src):([\w-]+)\}\}|\{\{(icon|social)\}\}/g,
  (token, kind, id, name) => {
    if (name === 'social') return social();
    if (name === 'icon') {
      const buf = readFileSync(path.join(IMAGES, 'apple-touch-icon.png'));
      return `data:image/png;base64,${buf.toString('base64')}`;
    }
    const image = byId.get(id);
    if (!image) throw new Error(`${token} names no image in the manifest`);
    used.set(id, (used.get(id) ?? 0) + 1);
    const { width, height, uri } = load(id);
    if (kind === 'src') return uri;
    return `src="${uri}" width="${width}" height="${height}" alt="${attr(image.alt)}"`;
  },
);

const problems = [];
for (const id of byId.keys()) {
  const n = used.get(id) ?? 0;
  if (n !== 1) problems.push(`${id} is used ${n} times (want exactly 1)`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const out = path.join(here, 'index.html');
writeFileSync(out, html);
const mb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
console.log(
  `Wrote ${path.relative(process.cwd(), out)} — ${mb} MB, ${manifest.images.length} images inline`,
);
