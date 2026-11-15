# Zanele Potelwa — concept site

A single-page site for Zanele Potelwa, The People's Champion, built from the
2027 website brief, the marketing strategy and the 18 supplied images. It
follows the brief's homepage runway: hero, credentials, The Zanele Edit, the
four pillars, The Slate, events, partnerships, booking and community.

It is a concept preview for review, not the official website, and says so in
its footer. Search engines are told not to index it until `site.json` says
otherwise.

## Two pages from one source

| File | What it is |
|---|---|
| `Zanele_Potelwa_Website.html` | **The whole site in one file** (about 3.4 MB). Every photograph and both fonts are written into it, so it opens from a WhatsApp document, AirDrop, email or a phone's Files app with nothing alongside it. |
| `index.html` | **The hosted page** (about 160 KB). Photographs and fonts are separate files in `images/` and `fonts/`, the hero is preloaded and everything below the fold loads lazily. Upload the folder as it is to any static host. |

iOS Quick Look runs no JavaScript, so the page is built to read completely
without it: every image and section, the menu (a native `<details>`), and each
form replaced by an email link with the questions already written out.

With JavaScript on it adds the translucent header, entrances, the stepped
forms, the phone dock and a full-screen photo viewer.

## What is on the page

| Section | From the brief | Images |
|---|---|---|
| Hero | Positioning, proposition, two calls to action | `IMG_7884` (and a portrait crop for phones and tablets) |
| 01 About | Biography, credentials strip, brand promise | `IMG_7893`, `IMG_7888`, `IMG_7880` |
| 02 Shows & media | Current broadcast work and career credits | `IMG_7896`, `IMG_7876`, `IMG_7894`, `IMG_7878` |
| 03 The Zanele Edit | Flagship, People / Places / Culture, planned pilot | `IMG_7881`, `IMG_7892` |
| 04 Four pillars | Presenter, Personality, Connector, Builder | `IMG_7883` |
| 05 The Slate | Travel, Style, Next Voice, Live | `IMG_7889`, `IMG_7891`, `IMG_7887`, `IMG_7885` |
| 06 Events | Public fixture list, on-air listing, archive | `IMG_7877` |
| 07 Work with Zanele | Offer ladder, categories, partnership brief | `IMG_7895` |
| 08 Book Zanele | Request-to-book | `IMG_7890` |
| 09 Community | Separate email and WhatsApp opt-ins | — |
| 10 Press & contact | Media kit, general enquiries | — |

All 18 images are used exactly once, with the source filenames preserved. The
build fails if one is missing or used twice. Alt text, titles and the section
each belongs to are in `images/manifest.json`.

Career credits are the ones recorded in the strategy (checked against public
sources on 15 November 2026). Nothing else is claimed: no audience figures,
rates, sponsors, dates or quotes.

## The forms: no server, and honest about it

There is no backend behind this page. The three forms check what was typed,
show it back, and write it into an email the visitor sends from their own mail
app. The page never says a request was received, because it cannot know.

- **Book Zanele** (3 steps): role, event, date, place, audience, contact,
  budget range, notes. A date less than two weeks away is flagged, not blocked.
  The copy says throughout that a request does not reserve the date.
- **Partnership brief** (4 steps): brand, category, objective, audience,
  territory, timing, budget range, deliverables, usage rights and exclusivity.
- **Community**: email and WhatsApp are two separate, unticked choices. The
  opt-in email records which was chosen, the wording version and the time.

Each request carries a reference (`ZPB-…` booking, `ZPP-…` partnership), the
consent wording version, and any `utm_source` / `utm_medium` / `utm_campaign`
from the link the visitor arrived by. A draft is kept in that browser tab only
(`sessionStorage`), so a reload or a validation error loses nothing.

The budget ranges in both forms are placeholders for the visitor to choose
from, not a rate card. Management should set them.

## Settings — `site.json`

```json
{
  "siteUrl": "",
  "ogImageUrl": "https://raw.githubusercontent.com/…/og-image.jpg",
  "indexable": false,
  "enquiries": { "email": "info@legacyleverage.co.za", "consentVersion": "2026-11-v1" },
  "formats": { "zanele-edit": "in development", "travel": "concept", "style": "concept", "next-voice": "concept", "live": "concept" },
  "events": [ { "title": "32nd South African Music Awards", "start": "2026", "venue": "Sun City", "role": "Co-host", "status": "completed" } ]
}
```

- **`enquiries.email`** receives every booking, brief, opt-in and press
  request. It is set to the address printed on the strategy document.
  **Confirm the right address with management before sharing the page.**
  Change `consentVersion` whenever the consent wording changes.
- **`formats`** is the brief's status list: `concept`, `in development`,
  `pilot`, `active`, `paused`, `archived`, or `hidden`. The label is shown on
  the page. `hidden` removes a Slate format from the page altogether and the
  build reports which photograph is held back with it. Nothing is `active`
  until Zanele has approved its name, format, rights and launch timing.
- **`events`** is the public fixture list. Only add what is approved for
  public release.

  ```json
  { "title": "…", "start": "2027-03-14T18:00", "end": "2027-03-14T20:30",
    "venue": "…", "city": "…", "url": "https://…", "action": "Tickets",
    "status": "scheduled" }
  ```

  `start` is South African time: a date and time, a date, or just a year.
  `status` is `scheduled`, `postponed`, `rescheduled`, `cancelled` or
  `completed` (completed events move to *On the record*). A scheduled event
  with a time gets an *Add to calendar* file. With no upcoming events the page
  says so plainly.
- **`siteUrl`** — once the site has a home, put its address here and rebuild.
  That adds `og:url`, and with `indexable: true` the canonical link.
- **`ogImageUrl`** — chat apps only fetch a share image from a public
  `https://` address. It points at `images/og-image.jpg` pinned to a commit in
  this repository, so link previews work wherever the page is hosted.
- **`indexable`** stays `false` for a review preview (`noindex`).

## Rebuilding

```bash
node sites/zanele-potelwa/build.mjs                    # build both pages
node sites/zanele-potelwa/build.mjs --masters <dir>    # re-derive the images first
```

`--masters` expects `IMG_7876.png` … `IMG_7896.png` (or `.jpg`) and needs
Python 3 + Pillow. The masters are not committed; the JPEGs in `images/` are,
at the masters' own pixel size.

- `src/index.html` is the template; `src/styles.css`, `src/site.js`,
  `src/viewer.js` and `src/forms.js` are pasted into it.
- `{{img:IMG_7889}}` becomes the image's `src`, `width`, `height` and `alt`.
- `<!-- format:travel --> … <!-- /format:travel -->` wraps what a hidden
  format removes.

**Image size.** The supplied masters are 1344 × 752 (landscape) and
896 × 1120 (portrait). That is enough for cards and phones, but the full-width
hero and banners are enlarged on desktop screens and will look soft. Larger
originals, dropped into a masters folder with the same names, fix this with
one rebuild (update `master` sizes and crops in `images/manifest.json`).

## Design notes

- Palette from the brief: forest `#0B3B2E`, ivory `#F7F3EA`, gold `#F2B915`,
  charcoal `#202824`, fuchsia `#D51E72` used sparingly.
- Headlines are set in Fraunces (variable, with its optical-size axis, so the
  cut sharpens as the size grows). Body, labels and forms use the device's
  system font. Fraunces is licensed under the SIL Open Font License
  (`fonts/OFL.txt`).
- Motion follows Apple's fluid-interface rules. Buttons answer on press. The
  photo viewer grows out of the photograph you tapped and returns to it,
  tracks the finger 1:1, carries a flick's velocity into the spring that
  finishes it, can be caught mid-flight, rubber-bands at the first and last
  photograph, and drops to cross-fades under *Reduce Motion*.
- The header and the phone dock are translucent materials; they turn solid
  under *Reduce Transparency* and *Increase Contrast*.
- On a phone the portrait hero reserves the frame down to her shoulders, so
  the title never sits on her face however short the screen is.

## Measurement

No tracker ships with the page. Each conversion step carries a `data-track`
name and is pushed to `window.dataLayer` as `zp_<name>` if a tag manager is
ever installed: `hero_edit`, `hero_partner`, `nav_book`, `dock_book`,
`dock_brief`, `partner_brief`, `brief_send`, `book_send`, `community_join`,
`events_updates`, `press_kit`, `share_whatsapp` and others.

## What was checked

Run in Chromium against both pages:

- Layout at 360, 390, 430, 820, 1280, 1440 and 1920 px wide, with no sideways
  scroll, and the phone hero on four screen heights.
- Booking, partnership brief and community forms end to end: validation,
  inline errors, focus, draft restore after reload, the composed email, copy
  to clipboard, restart.
- Photo viewer: open from a thumbnail, arrow keys, a flick, drag down to
  close, Escape, focus return.
- The one-file page with JavaScript off, and loaded from disk with no network
  requests.
- *Reduce Motion*, and axe-core WCAG 2.2 AA rules on desktop and phone (no
  violations; text over photographs is outside what axe can measure).

Not checked: real iOS Safari and Android Chrome devices, and how each mail app
handles the prefilled email.

## Not built yet, from the brief

The brief describes a full platform. This is its first phase: the visual
foundation and the conversion journeys. Still to come, each needing accounts
or decisions that do not exist yet:

- **CMS and admin dashboard, booking pipeline, partnership CRM** — need a
  backend (the brief suggests Supabase) and hosting.
- **WhatsApp Business messaging, email acknowledgements** — need Meta / BSP
  access, an approved sender number and templates. Until then no message is
  ever sent automatically.
- **Separate pages per route** (`/about`, `/events/[slug]`, episode pages) with
  their own metadata and Event / VideoObject structured data — worth doing once
  there is approved content to fill them. The page carries Person structured
  data only.
- **Service worker and offline shell** — left out on purpose for a preview
  under review, where a cached copy would show reviewers stale pages. The web
  app manifest and home-screen icons are in place.
- **Analytics, Search Console, sitemap and robots.txt** — need the launch
  domain.

## Before this goes public

- Zanele's and management's approval of the copy, credits, format names and
  the enquiry address.
- Image rights and likeness approval. The strategy describes the imagery as
  art-direction reference: final photography and credits are needed.
- Broadcaster clearance for programme names; links and schedules are added
  once each is cleared.
- The actual booking service menu, budget ranges, travel rules and notice
  periods.
- A privacy notice and POPIA review. The footer carries a short, accurate note
  on what this preview does with data.
