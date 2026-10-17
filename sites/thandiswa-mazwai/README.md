# Thandiswa Mazwai — concept site

A single-page artist site built from the supplied handoff and its 22-image
library. **`index.html` is the whole site**: every photograph is written into
the file itself, so it opens anywhere with nothing else alongside it.

It is a concept preview for review, not the official website, and says so in
its footer. Official information stays at [thandiswa.com](https://thandiswa.com/).

## Sharing it

| How | What happens |
|---|---|
| Send `index.html` as a WhatsApp **document**, by AirDrop or by email | Opens in iOS Quick Look, Android's browser or any desktop browser. Quick Look runs no JavaScript, so the page is built to read completely without it: every image, every section, the menu (a native `<details>`). |
| Host it and share the **link** | Chats show a preview card with the title, description and `images/og-image.jpg` (1200×630, 97 KB — under WhatsApp's limit). |
| Open it with JavaScript on | Adds the extras: the translucent header, gentle entrances, and a full-screen photo viewer (tap any photograph, or *View all 22 photographs*). |

The viewer follows Apple's fluid-interface rules: it grows out of the
photograph you tapped and returns to it, tracks the finger 1:1, carries a
flick's velocity into the spring that finishes it, can be caught mid-flight,
rubber-bands at the first and last photograph, and drops to cross-fades under
*Reduce Motion*. Swipe sideways to page, drag down to close, or use ← → and Esc.

## Link previews and hosting — `site.json`

A preview card needs the share image at a public `https://` address; a chat app
will not read an image out of the page. That is the only part of the site that
depends on where it is hosted.

```json
{ "siteUrl": "", "ogImageUrl": "https://raw.githubusercontent.com/…/og-image.jpg", "indexable": false }
```

- **`ogImageUrl`** currently points at the share image pinned to a commit in
  this repository, so previews work wherever `index.html` is hosted.
- **`siteUrl`** — once the site has a home, put its address here and rebuild.
  That adds `og:url`, and if `ogImageUrl` is emptied, serves the share image from
  that host instead (upload `images/og-image.jpg` next to `index.html` as
  `og-image.jpg`).
- **`indexable`** stays `false` for a review preview, which emits
  `<meta name="robots" content="noindex">` so it never competes with the
  official site in search. Set it to `true` only on the confirmed launch domain;
  with a `siteUrl` that also adds the canonical link.

Any static host works: GitHub Pages, Netlify Drop, Vercel, or the artist's own
server. Upload `index.html` (and `og-image.jpg` if you rely on `siteUrl`).

## Rebuilding

```bash
node sites/thandiswa-mazwai/build.mjs                    # inline the committed images
node sites/thandiswa-mazwai/build.mjs --masters <dir>    # re-derive them from the masters first
```

`--masters` expects `IMG_7137.png` … `IMG_7158.png` (or `.jpg`) and needs
Python 3 + Pillow, like the app's own image scripts. The 22 masters (about
170 MB) are not committed; the derivatives in `images/` are.

- `src/index.html` — the template. `{{img:IMG_7145}}` becomes the image's
  `src`, `width`, `height` and `alt`.
- `images/manifest.json` — per image: alt text, section, derivative width and
  crops (the portrait hero for phones, the share image, the home-screen icon).
- The build **fails** unless every one of the 22 images is used exactly once,
  so an image cannot go missing and none is embedded twice.

## Before this goes public

Carried over from the handoff, and still open:

- Artist/management approval of the copy, the biography excerpt and quote,
  the discography years and the booking address (`thandiswabookings@gmail.com`).
- Image rights, likeness approval and photographer credits for all 22 images.
- The still lifes in Music are labelled illustrative; swap in official album
  artwork when it is supplied.
- Live dates: only the past Sankofa Heritage Festival (28 Feb 2026) is listed,
  as an archive entry. No upcoming date is shown until one is confirmed.
- The shop sells nothing and the page collects nothing; bookings go by email.
