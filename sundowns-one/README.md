# Sundowns One: the fan app (concept prototype)

A concept supporter app for Mamelodi Sundowns and the Yellow Nation, built from
the LegacyLeverage V5 brief (master blueprint, build brief, fan growth playbook,
sponsorship prospectus and the V5 HTML prototype) and the 51 supplied images.

**Not an official club product.** Fixtures use fictional opponents with dates
set from today. Tickets, Passport points, rewards, prices and partners are all
samples. Nothing is bought, sent or uploaded; the only storage is the phone's
own browser storage.

## Open it

| File | What it is |
| --- | --- |
| `Sundowns_One_Fan_App.html` | The whole app in one file (3.9 MB): every image, the crest, icons and metadata embedded. Works offline. Opens on any phone or computer, and can be sent as a WhatsApp document. |
| `site/` | The installable web app: `index.html` (0.3 MB) plus `img/`, a web app manifest, an offline service worker, home-screen icons and a copy of the single file for its download button. Photos load only when a screen shows them. |
| `Sundowns_One_Artifact.html` | The same app formatted for the claude.ai Artifact viewer (no document wrapper, no file links, no service worker). |
| `og-image.jpg` | 1200 × 630 social preview (WhatsApp, X, LinkedIn). |
| `TESTING.md` | What was tested and how. |

On iPhone, open the hosted link in Safari, then Share → Add to Home Screen. On
Android, Chrome → ⋮ → Add to Home screen. A downloaded copy of the single file
opens fully on Android; on iPhone the Files preview shows every screen as a
static page (the file is prerendered for that), and the interactive app needs
the hosted link.

## What's in the app

Five tabs, as on iOS: **Today**, **Matches**, **Matchday**, **Passport** and
**More**. On a computer the tabs become a sidebar.

| Area | Screens |
| --- | --- |
| Today | Hero, next home match with countdown, quick actions, Passport, stories, Bring Your Crew, Fan Zone, one partner spot, Club Impact |
| Matches | Fixtures and results for men, women and academy; a sample live Match Centre (timeline, stats, Player of the Match vote) |
| Matchday | Ticket card (official seller handoff, no home-made ticket codes), how matchday works, planner (crew, travel, your own budget estimates, checklist, share), stadium guide with an illustrative map, getting there, food and drink with an order-ahead pilot, accessibility and family |
| Passport | Points, stamps, how it works, rewards with a redeem flow, member benefits, activity ledger, rules |
| More | Fan Zone (predictor, crest quiz, stadium QR challenge, photo sharing with review), Watch and Listen, Community (branches, Global Masandawana with kick-off in each city's time, away days, Supporter Voice), Experiences (register interest, not booking), Official Store, Partner World, Club Impact, Ask Sundowns, Help and safety, You (teams, message choices, appearance, text size, low-data mode, language, privacy), About, Asset library |

The eight four-panel storyboards are split into swipeable steps, with the
captions set as real text so screen readers and translation can use them.

## Design

Built to Apple's interface principles, for the web:

- **System font** (SF Pro on Apple devices, Roboto on Android) with tracking
  that changes with size, and Apple's text styles from Large Title to Caption.
- **Large titles** that hand over to a compact title in a translucent bar as you
  scroll; a translucent tab bar with content scrolling underneath.
- **Springs, not timed animations.** Pushing a screen slides it in from the
  right and Back returns it the same way. Bottom sheets follow your finger 1:1,
  resist past the top, and on release carry your flick's velocity into the
  spring; a hard flick dismisses them (Apple's momentum projection).
  Everything can be interrupted: closing a sheet hands the page back at once.
- **Feedback on press**, not on release; a short vibration only for real
  commits (vote cast, plan saved, reward redeemed) on phones that support it.
- **Light and dark** follow the phone, or can be set in You → Display.
  Reduce Motion swaps slides for fades, Reduce Transparency makes the bars
  solid, Increase Contrast strengthens edges, and text size goes to 125%.
- Brand colours come from the supplied material: club yellow, and the deep
  green (#0C3E2E) of the storyboard caption bars.

### Premium layer

- **Immersive headers with parallax.** Thirteen screens open on a full-bleed
  photo that moves at under half the page's speed, eases in over the first
  160 px so it never jolts, fades its title as it goes, and stretches when you
  pull down past the top (iPhone rubber-band). With a mouse, the Today photo
  leans gently away from the pointer on two critically damped springs.
- **Photos with depth.** Card photos drift up to 7% as they cross the screen;
  photos in sideways rails slide as the rail scrolls. Every photo is scaled so
  it always covers its frame (tested at every scroll step).
- **Floating glass tab bar** with a lens that slides to the active tab on a
  spring, in the style of iOS 26.
- **Wallet-style matchday pass** with gate, block, row and seat, a
  perforation, and no home-made ticket code.
- **Passport member card** with a metallic edge, a guilloché texture and a
  sheen that follows the pointer, or the scroll on a phone.
- **Live countdown** to kick-off, and a scroll-edge fade under the top bar
  instead of a hard line.
- **Get Sundowns One** (More, first row): Add to Home Screen steps for iPhone
  and Android, an Install button where Android Chrome offers one, Share on
  WhatsApp, and the app file to send as a document.
- **Metadata:** Open Graph and X cards with a 1200 × 630 preview, structured
  data (schema.org WebApplication, marked as a concept), theme colours for
  light and dark, home-screen icons and a web app manifest.

## What the app promises (from the brief)

- No fabricated fixtures, scores, prices, player names, partners or approvals.
  Every sample is labelled as one.
- Tickets come only from the official seller; the app never draws its own
  ticket QR code.
- Budget figures are the supporter's own estimates, not club prices.
- Sharing a plan sends the match, crew size and travel only, never a ticket or
  location.
- Message choices start off, nothing is pre-ticked, each change is recorded
  with its time, and no points are given for consent.
- Passport points come only from verified attendance and approved activities.
- Ask Sundowns cites a source for every answer, says when it has no checked
  answer, and sends money, entry, safety, accessibility and personal-data
  questions to a person. (In the prototype it answers from a small set of
  approved app content, not a live AI service.)
- Emergency information never depends on marketing choices.
- Partners see totals only, never supporters' details.

## Images

All 51 supplied images are in the app's **Asset library** (More → Asset
library), each with where it's used, its alt text and its status:

| Status | Count | Meaning |
| --- | --- | --- |
| In the app | 28 | Placed on a screen as supplied |
| Cropped | 4 | Placed after a crop (see below) |
| Review | 4 | Placed, with one issue to clear before release |
| Hold | 7 | Library only: rival-sport branding, third-party logos or unremovable landmarks |
| Staff | 8 | Club Studio material, not part of the fan app |

Crops: IMG_7688 (framed Cape Town Stadium picture removed), IMG_7694 (the
generated headline that misspells "Masandawana" removed; the app sets the title
as real text), IMG_7701 (Table Mountain removed), IMG_7705 (rugby posts
removed).

On hold: IMG_7686 (Springbok emblems), IMG_7690 (rugby posts), IMG_7703 (Puma
logo and a generated club-style emblem), IMG_7706 (Table Mountain fills the
background), IMG_7712 (Springbok cap, rugby posts), IMG_7716 (garbled on-screen
text, Table Mountain), IMG_7724 (Puma logos and generated crests; Ask Sundowns
uses the information-desk photo instead).

To review: IMG_7674 (the crest, cut out of a logo-site screenshot; replace with
the club's official vector), IMG_7679 (a sportswear logo on a fan's shirt),
IMG_7683 (the stadium looks like FNB Stadium, not Loftus Versfeld), IMG_7713
(Table Mountain faintly in the background).

The images are generated concept art. Nobody pictured is a real player, so
never caption them with player names.

## Rebuilding

Requires Python 3 with Pillow and NumPy, and Node with Playwright.

```sh
cd src
# 1. Images: crops, WebP, crest cut-out, icons, social preview (once, from the uploads)
python3 -I prepare_images.py <folder with the 51 uploads>
# 2. The single file, then write each screen's first render into it
python3 -I build.py ..
node prerender.js ../Sundowns_One_Fan_App.html
# 3. The installable site, with the single file beside it for its download button
python3 -I build.py ../site --pwa --out-name index.html \
    --site-url https://your-host/sundowns-one/ --app-url https://your-host/sundowns-one/
node prerender.js ../site/index.html
cp ../Sundowns_One_Fan_App.html ../site/
# 3b. The claude.ai Artifact format
python3 -I build.py /tmp/viewer --viewer && node prerender.js /tmp/viewer/Sundowns_One_Fan_App.html
python3 -I make_artifact.py /tmp/viewer/Sundowns_One_Fan_App.html ../Sundowns_One_Artifact.html
# 4. Check it
node ../tests/check.js ../Sundowns_One_Fan_App.html
```

`prepare_images.py` maps each IMG number to its upload file name; the prepared
images in `src/img/` and `src/brand/` are committed, so steps 2 to 4 work
without the uploads. Set `--site-url` to the real hosted address so link
previews resolve, and switch `robots` in `src/head.html` to `index, follow` only
once the club approves a public release.

| Source file | Purpose |
| --- | --- |
| `src/app.js` | The app: data, screens, router, springs, sheets, parallax |
| `src/styles.css` | Design system: tokens, type scale, components, accessibility modes |
| `src/head.html`, `src/body.html` | Page shell and metadata |
| `src/icons.json` | Line icons on a 24-point grid |
| `src/assets.json` | The 51 images: title, alt text, use, status, notes, crops |
| `src/panels.json` | Measured photo panels inside each storyboard |
| `src/pwa/` | Manifest, service worker, home-screen icons |
| `src/make_artifact.py` | Reformats a build for the claude.ai Artifact viewer |

## Before this goes near production

This is the experience layer only. The build brief's first deliverables still
apply: an audit of the club's systems and contracts, the integration matrix
(ticketing, membership, store, fixtures, CMS, CRM and consent, venue
operations), the data model, the POPIA, safeguarding and rights risk register,
and supporter testing, before any live integration.
