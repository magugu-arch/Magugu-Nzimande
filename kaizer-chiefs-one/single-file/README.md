# Kaizer Chiefs One · single-file concept app

**`Kaizer_Chiefs_One_Concept.html`**: the whole concept app in one 1.5 MB file. Every image,
font and icon is inside it, so it opens offline from a phone's Downloads or Files app and as a
WhatsApp document, with nothing to install and no network needed.

Not an official Kaizer Chiefs product. All content is DEMO or SAMPLE, every photograph is a
labelled CONCEPT IMAGE, and the crest is a reserved placeholder.

## Opening it

| Where | What happens |
| --- | --- |
| **Android · Chrome** (from Downloads, Files, or a WhatsApp document opened in Chrome) | The full app: tabs, Match Centre, the Fan Moments flow, the report sheet, saved preferences. |
| **iPhone · Safari** (Files → share → open in Safari, or a hosted copy) | The full app. |
| **iPhone · WhatsApp or Files preview** | A read-through version: a short intro, a contents list that jumps to any screen, then every screen one after another with its images. This preview does not run JavaScript, so nothing is tappable beyond the links. |
| **Android · HTML viewer** (WhatsApp's default "open" on some phones) | The same read-through version. |

To send it on WhatsApp, attach it as a **Document**. Where the browser allows sharing files (most
iPhones), the app shows **Share this file** on the Welcome and About screens. When the file is
served from a web address, **Save this file** downloads a copy.

## What is inside the file

- 24 screens: Welcome, Home, four sample stories, Match (fixtures, results, squad), Match Centre,
  player profile, Fan Moments, Share a moment, My moments, a Fan Moment with reporting, Community
  rules, Tickets, Membership, Khosi Rewards, Shop, Notifications, Profile, Notification
  preferences, Privacy, Help and About.
- 9 concept images, each embedded once as JPEG with camera and location metadata removed.
- Barlow Condensed, Inter and DM Mono (Latin subsets, SIL OFL 1.1).
- Metadata: title and description, Open Graph and Twitter card tags for link previews, an
  Add-to-Home-Screen icon, `noindex` so search engines leave it alone, schema.org data that
  describes it as a concept prototype, and an embedded JSON register of every image (file, size,
  where it is used, alt text, reference-canvas node). The About screen shows the same register.

The same rules as the Expo app apply: no scores, no real-looking fixtures, no player names, no
membership status, no points balance, no prices and no scannable ticket code. The Fan Moments flow
checks consent and file limits, then keeps the moment on the device only; nothing is uploaded,
and the file collects and sends nothing.

## Design and motion

Same editorial system as the app: full-bleed photography falling into black, gold-ruled mono
eyebrows, the gold italic accent line, flat gold calls to action. Motion follows Apple's
fluid-interface guidance: press feedback on touch-down; screens deeper in the hierarchy push in
from the right and return the way they came, while tabs cross-fade; the tab and section markers
are springs that re-target mid-flight; the report sheet follows the finger, rubber-bands at the
top, and decides from a projection of your flick whether to close, carrying your speed into the
spring. Reduce Motion swaps all of it for instant changes; Reduce Transparency and Increase
Contrast are respected.

## Rebuilding

From `kaizer-chiefs-one/` (needs Python 3 with Pillow, and the workspace's `node_modules` for the
preview-image fonts):

```bash
python3 -I single-file/src/build.py                      # writes the HTML and og-image.jpg
node single-file/tests/check.mjs --shots .screens/sf      # 29 checks, screenshots
```

Sources are in `src/`: `head.html` (metadata), `body.html` (every screen), `styles.css`,
`app.js`, `fonts/` (with licences) and `build.py`, which also generates the fixture, result and
squad blocks and the image register.

**Link previews.** When the file is hosted on a web address, rebuild with
`--site-url https://your-host/path/` and upload `og-image.jpg` beside it, so WhatsApp and other
apps can show the preview image (they need an absolute address). A file sent as a document shows
WhatsApp's document card instead.
