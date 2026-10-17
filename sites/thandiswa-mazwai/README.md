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

The front page follows the supplied prototype: the brand stack and boxed
*Menu +*, the outlined *MAZWAI*, the rust and gold palette, typewritten labels
and the rust marquee. The hero is the full-resolution master; phones get their
own crop that keeps her face whole and clear of the type.

The viewer follows Apple's fluid-interface rules: it grows out of the
photograph you tapped and returns to it, tracks the finger 1:1, carries a
flick's velocity into the spring that finishes it, can be caught mid-flight,
rubber-bands at the first and last photograph, and drops to cross-fades under
*Reduce Motion*. Swipe sideways to page, drag down to close, or use ← → and Esc.

## Bookings and deposits

*Book an appearance* opens a three-step booking: the event (type, dates, city,
venue, audience, length), the contact's details (with inline validation and a
consent tick), then a review with two ways out:

- **Pay the deposit** — the page posts the order to **PayFast's hosted
  checkout** and PayFast takes it from there (card, Instant EFT and its other
  methods). Card details are typed on PayFast's page, never on this one. The
  booking travels with the payment — reference, event, dates, city, audience,
  organisation, venue, budget, phone and notes — and PayFast emails a copy to
  the bookings address. Coming back shows a confirmation with the reference;
  cancelling returns to the review with nothing lost.
- **Send without paying** — opens an email to the bookings team with the whole
  brief and the reference filled in.

A draft survives a reload and the round trip to PayFast (it is kept in that
browser only), and every booking says it is confirmed only once the team
replies in writing.

### Test mode and going live — `site.json` → `booking`

```json
"booking": { "mode": "test", "depositZAR": 5000, "email": "thandiswabookings@gmail.com",
             "payfast": { "merchantId": "", "merchantKey": "", "notifyUrl": "" } }
```

It ships in **`test`** mode: deposits go to PayFast's public sandbox, no money
moves, and the page says so in a banner. Test orders are signed with the
sandbox passphrase PayFast publishes in its developer docs. **R5 000 is an
example amount**, not a quoted deposit. To take real deposits:

1. Management confirms the deposit amount, what it secures and its refund terms,
   and adds those terms (and a privacy notice for the details collected) to the page.
2. In the PayFast dashboard, copy the live **merchant ID and key** into
   `payfast`, set `mode` to `"live"`, and rebuild. The build refuses `live`
   without them.
3. Leave the PayFast **passphrase unset**: a passphrase needs a signature, and a
   signature can only be made safely on a server.
4. Until a server exists, check each payment's amount and reference in the
   PayFast dashboard before treating a date as held — the browser can be told
   anything. For automatic confirmation, add a small server endpoint that
   verifies PayFast's ITN callback and set its address as `notifyUrl`.
5. Host the page on `https://`. From a file or a chat preview, PayFast cannot
   send the visitor back to the page afterwards. It shows its own result page
   instead, and the email receipt still arrives.

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
  crops (the tall hero for phones, the share image, the home-screen icon).
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
- The shop sells nothing. Bookings take deposits only in test mode until the
  steps under *Test mode and going live* are done.
