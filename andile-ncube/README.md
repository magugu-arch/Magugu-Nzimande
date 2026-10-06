# Andile Ncube — The House That Andile Built

Owned-media website for Andile Ncube, built to the *Claude Code Master Website
Brief*. It positions Andile as owner, broadcaster, host and storyteller; makes
**The House That Andile Built** the hero property; explains the Sponsor Engine
to brands; presents the Slate; and turns interest into structured partnership
enquiries.

**Stack:** Next.js 16.4 (App Router, Cache Components, Turbopack) · React 19 ·
TypeScript · Tailwind CSS 4 · GSAP + ScrollTrigger · Lucide icons

This is a self-contained project inside the Expo repository. It has its own
`package.json`, lockfile, lint config and CI job, and the root Expo tooling
ignores it.

## Run it

```bash
cd andile-ncube
npm install
cp .env.example .env.local   # optional — everything works without it
npm run dev                  # http://localhost:3000
```

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Dev server                                        |
| `npm run build`     | Production build (prerenders every route)         |
| `npm start`         | Serve the production build                        |
| `npm run typecheck` | Generate route types, then `tsc --noEmit`         |
| `npm run lint`      | ESLint (Next.js core-web-vitals + TypeScript)     |
| `npm run verify`    | typecheck → lint → build                          |

## Environment

| Variable                 | Required | Purpose |
| ------------------------ | -------- | ------- |
| `NEXT_PUBLIC_SITE_URL`   | In production | Canonical URLs, Open Graph, sitemap. Falls back to `http://localhost:3000`. |
| `ENQUIRY_WEBHOOK_URL`    | To go live | Where enquiries are delivered (Zapier, Make, a CRM intake, your own endpoint). **Unset = preview mode.** |
| `ENQUIRY_WEBHOOK_SECRET` | Optional | Signs each delivery: `X-Signature` = hex HMAC-SHA256 of the `enquiry` JSON part. |

**Preview mode is honest.** Without a webhook the forms validate and complete,
but nothing is sent or stored, the API responds `delivery: "preview"`, and the
success screen tells the visitor in plain words. Nothing pretends to be live.

## Routes

| Route | Contents |
| --- | --- |
| `/` | Hero → Chapter intro + four pillars → The House (pinned build story) → The Flagship + episode rail → Short-form multiplier → The Slate → Sponsor Engine → The Institution → Ownership statement → 90-day pilot → Build with us (deck) → Final statement |
| `/house` | The build story VISION → FOUNDATION → BUILD → REVEAL → OWNERSHIP, materials, on-site |
| `/flagship` | Format, episodes, short-form multiplier |
| `/flagship/[slug]` | Episode: persistent player (desktop), metadata, behind the build, key moments, shorts, related |
| `/slate` | Sport, Lifestyle, Fatherhood with status (Concept / In development / Pilot / Live) |
| `/partners` | Sponsor Engine (five interactive categories), Institution, 90-day pilot, deck, **partnership enquiry** (`#enquire`) |
| `/story` | Biography (draft), roles, ownership |
| `/journal`, `/journal/[slug]` | Journal with category filter; articles |
| `/press` | Biography, headshots, show information, press photographs, downloads, media contact |
| `/api/partnership` | POST — enquiry and deck-request intake |

`sitemap.xml`, `robots.txt`, an SVG icon and a 404 page are generated too.

## Structure

```
app/          routes, metadata, sitemap, robots, API route
components/   reusable UI (Header, MobileMenu, Media, Motion, Rail, SponsorGrid, PartnershipForm, …)
sections/     homepage-scale sections composed by the routes
data/         ALL content — copy, episodes, formats, sponsors, stories, press, enquiry options
lib/          types (content models), analytics, SEO helpers, enquiry validation + delivery
public/images supplied photography
styles/       design tokens and global CSS
```

Content is kept out of components. `lib/types.ts` defines the CMS-ready models
— `Episode`, `Format`, `SponsorCategory`, `Partner`, `Story`, `MediaAsset`,
`Download` — and every `data/*.ts` module conforms to them. To move to a CMS,
replace a data module with a fetch that returns the same shape.

## What is placeholder, and how to replace it

The brief forbids inventing facts, partners, numbers, titles or dates. Where
real content was not supplied the site says so on the page — nothing is
dressed up as real.

| Item | Where | Shown as | To go live |
| --- | --- | --- | --- |
| Episodes (titles, dates, runtime, video, moments, shorts) | `data/episodes.ts` | "Placeholder", "Title to be confirmed"; poster says "Not yet published". Episode pages are `noindex` and left out of the sitemap. | Fill the fields, set `video.src` (+ `captions`), set `status: "published"`. VideoObject schema then appears automatically. |
| Format names and statuses | `data/formats.ts` | "Name to be confirmed", all **Concept** | Set `name` and `status` as they are approved. |
| Fatherhood imagery | `data/formats.ts` | Type only, no image | Add approved images to `images`. |
| Journal entries | `data/stories.ts` | "Draft — for approval" | Edit or replace; set `status: "published"` and `publishedAt` to emit Article schema. |
| Biography | `data/press.ts` | The brief's suggested opening, marked draft | Replace with the approved text, set `status`. |
| Partnership deck PDF | `data/site.ts` → `partnershipDeck.href` | "Download" opens a 3-field request form | Put the PDF in `public/downloads/` and set `href` — the button becomes a direct tracked download. |
| Press PDFs (bio, show sheet) | `data/press.ts` | "On request — file not yet supplied" | Set `href`. |
| Media contact | `data/site.ts` → `mediaContact` | Routes to the enquiry form | Set name and email. |
| Confirmed partners | `data/sponsors.ts` → `partners` | Not shown (empty) | Add entries once agreed. |
| Budget ranges | `data/enquiry.ts` | Qualification options only, labelled "not a quote or a rate" | Edit to suit. |
| Sponsor placement / inventory lines | `data/sponsors.ts` | Labelled "Proposed structure. Final inventory and terms are set in the rate card." | Align with the rate card. |

## Image library

All 27 images the brief names are in `public/images/` under their brief
filenames (IMG_6889–IMG_6910 and IMG_6160, 6161, 6165, 6166, 6167) and placed as
its image mapping directs. For example:

| Image | Placement |
| --- | --- |
| IMG_6889 / IMG_6910 | Homepage hero — landscape on wide screens, the vertical portrait on phones |
| IMG_6165 (keyhole) | Chapter 01 intro, press headshots |
| IMG_6166 → IMG_6160 → IMG_6894 → IMG_6897 → IMG_6161 | House build story: Vision → Foundation → Build → Reveal → Ownership |
| IMG_6905, IMG_6907, IMG_6906 | Flagship; IMG_6905 also leads the short-form multiplier |
| IMG_6896, IMG_6908, IMG_6161 | Slate — Lifestyle |
| IMG_6903 | Slate — Sport |
| IMG_6902, IMG_6909 | Sponsor Engine, Build with us |
| IMG_6891, IMG_6910, IMG_6167, IMG_6904 | Story and Press |

IMG_6897 (supplied as a 6 MB PNG) is stored as a 2400 px JPEG, and the PNGs
among IMG_6160–IMG_6167 as JPEGs. Next.js serves every image as AVIF/WebP with
responsive `srcset`. An extra 363×460 studio portrait was also supplied; it is
too small for any slot on the site, so it is not used.

To add or swap an image: copy it into `public/images/`, add its ID to `MediaId`
in `lib/types.ts` and an entry to `data/media.ts` (with alt text and a focal
point), then point the relevant data at it.

## Downloadable edition

`standalone/dist/andile-ncube.html` is the whole site as **one self-contained
HTML file** (~3.4 MB): every section on a single scrolling page, with all 27
photographs, both typefaces and all metadata embedded. It opens from disk with
no server and no network.

```bash
npm run standalone   # rebuilds standalone/dist/andile-ncube.html
```

`standalone/build.mjs` reads the same `data/*.ts` modules as the Next.js site,
so content never drifts between the two. For every image it:

- **enhances** it lightly — a gentle levels stretch that leaves shadows alone,
  contrast ×1.04, saturation ×1.03, fine unsharp mask — then encodes WebP q80;
- **embeds metadata** in the file itself: EXIF `ImageDescription` (alt text)
  and an XMP packet with `dc:title`, `dc:description`, IPTC
  `AltTextAccessibility`, keywords and identifier. Press downloads carry it.

The page itself carries title, description, Open Graph and Twitter tags, and a
JSON-LD graph (WebSite, WebPage, Person, Organization, and an ImageGallery of
all 27 images). There are no `og:image` or canonical URLs because the file has
no hosted address; add them when it is deployed.

Interaction follows Apple's fluid-interface principles: rails track the
pointer 1:1, project flick momentum onto the nearest card and rubber-band at
the ends; episodes and journal entries open in a sheet you can drag down to
dismiss; every animation is a spring (critically damped by default, bounce
only after a flick) and can be grabbed mid-flight; buttons respond on press;
the header becomes a translucent material on scroll. It respects
`prefers-reduced-motion` (cross-fades only), `prefers-reduced-transparency`
(solid surfaces) and `prefers-contrast: more`.

The enquiry and deck forms validate fully but are **not connected**: the
success screen says so. Set `ENQUIRY_ENDPOINT` near the top of the page script
to post enquiries (the payload matches `/api/partnership`).

## Partnership enquiry

Seven steps, one question each: Opportunity → Company → Contact → Budget →
Objective → Message → Upload brief. ENQUIRE buttons on sponsor cards prefill
the opportunity and category from the URL.

- **Validation** — `lib/enquiry/validate.ts` runs in the browser for instant
  feedback and again in the route handler, which is the only one trusted.
- **Uploads** — PDF / DOCX / PPTX, 10 MB max. The server checks the extension
  *and* the file's magic bytes, caps the request body, and sanitises the file
  name. Files are forwarded to the webhook, never written to disk.
- **Spam** — a hidden honeypot field, a minimum fill time, and a best-effort
  per-IP rate limit (5 per 10 minutes, per server instance; skipped when no
  client IP header is present). Use your platform's firewall or a shared
  store for a hard limit.
- **Secrets** — webhook URL and secret are server-only; nothing sensitive
  reaches the browser.
- **No response-time promise** — none was supplied, so none is made.

## Analytics

`lib/analytics.ts` is the single boundary. Events are pushed to
`window.dataLayer` (GTM / Segment read this directly) and dispatched as an
`analytics` DOM event. **No vendor script is installed** — add your tag
manager and the events flow.

`hero_cta` · `watch_click` · `episode_start` · `episode_complete` ·
`slate_click` · `sponsor_category_view` · `partnership_start` ·
`partnership_complete` · `deck_download` · `press_download` · `journal_read`

Each carries `funnel_step` (`watch_explore` → `partnership` → `enquiry`) for the
VISITOR → WATCH/EXPLORE → PARTNERSHIP → ENQUIRY funnel.

## Motion, accessibility, performance

- GSAP + ScrollTrigger: masked line reveals, image settle/parallax, chapter
  wipes, scroll-driven 90-day timeline. The House build story is pinned with CSS
  `sticky` + IntersectionObserver. Rails are native scroll-snap.
- `prefers-reduced-motion`: no animation runs, and nothing is pre-hidden —
  pre-hiding is gated on the same media query and on JS having run.
- Skip link, visible focus rings in both themes, native `<dialog>` menu (focus
  trap, Escape), ARIA tabs with arrow-key support on the Sponsor Engine,
  labelled fields with errors wired via `aria-describedby`, 44 px+ targets,
  AA contrast on the palette's text pairings.
- Only the hero image is fetched eagerly; everything else lazy-loads. Every
  route is prerendered.
- JSON-LD: Person and Organization site-wide; VideoObject and Article only
  when real published content exists.

## Verified

Production build checked at 1440×900, 1280×800, 1024×768, 768×1024, 390×844 and
393×852 on every route: no horizontal overflow, no console errors. The
enquiry flow, deck request, server-side rejection of bad input and disguised
files, honeypot, rate limit, mobile menu, keyboard tabs, skip link and
reduced-motion rendering were exercised in Chromium.
