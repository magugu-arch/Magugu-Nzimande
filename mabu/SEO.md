# Mábu website: search

How the website is set up to be found, which searches it aims at, and what Mábu needs to do once the domain is
live. Written 28 September 2026.

## What the build does

`npm run export:web` produces `dist-web/`, a plain folder of files any host can serve:

- **78 pages, each its own HTML file** — the restaurant, the menu, every dish, every wine, every collection,
  every event, the private-functions page, how to find us, contact, gallery, gift vouchers, rewards and the
  legal pages.
- **The content is in the HTML.** The menu, prices, events and opening hours are written into each page before
  anyone opens it, so a search engine reads them without running JavaScript. The app refetches from the API on
  load, so what a guest sees is always current.
- **Each page carries** its own title, meta description, canonical address, Open Graph and Twitter card, and
  schema.org data: `Restaurant` with address and opening hours on the home page, `MenuItem` with price on each
  dish, `FoodEvent` with date and price on each event, and breadcrumbs.
- **`sitemap.xml`** lists every indexable page with a priority; **`robots.txt`** allows the site and blocks the
  private areas; **`og.jpg`** is the picture a shared link shows.
- **Anything personal is kept out of search by default** — profiles, bookings, sign-in, notifications and the
  staff area are `noindex` and disallowed in robots.txt.
- The build **fails** if a page has no title, no description, a description over 165 characters, or one that
  competes with another page.

Set the domain before exporting, or the canonical links will point at the placeholder:

```bash
EXPO_PUBLIC_SITE_URL=https://maburestaurant.com npm run export:web
```

## The searches this aims at

Mábu is one restaurant in one place, so the winnable searches are local and specific. Rough monthly volumes are
not published for most of these; the order below is by how likely the search is to end in a booking.

| Priority | Search | Page that answers it |
| --- | --- | --- |
| 1 | mabu restaurant · mábu waterfall · mabu midrand | `/home` |
| 1 | restaurant waterfall city · waterfall wilds restaurants · restaurants in waterfall midrand | `/home`, `/visit` |
| 1 | book a table midrand · restaurant booking waterfall city | `/book` |
| 2 | fine dining midrand · fine dining johannesburg north · african fine dining johannesburg | `/home`, `/menu` |
| 2 | steakhouse midrand · best steak johannesburg · tomahawk / wagyu midrand | `/menu`, `/dish/*` |
| 2 | private function venue midrand · private dining johannesburg · corporate venue waterfall city · wedding venue midrand | `/private-functions` |
| 3 | wine pairing dinner johannesburg · chef's table johannesburg · tasting menu midrand | `/events`, `/events/*` |
| 3 | restaurant gift voucher south africa · dining gift card johannesburg | `/vouchers/new` |
| 3 | seafood restaurant midrand · vegetarian fine dining midrand | `/menu`, `/dish/*` |
| 4 | halaal / gluten-free options midrand *(only once Mábu confirms what the kitchen certifies)* | `/menu` |

Each page's title and description were written for its search, for example:

- `/private-functions` → "Private Functions & Events Venue · Mábu Restaurant" — "Private dining, corporate
  events, celebrations, weddings and exclusive venue hire at Mábu, Waterfall City, Midrand."
- `/dish/sig-fillet` → "The Mábu Fillet · Mábu Restaurant" — the dish's own description plus "On the menu at
  Mábu, Waterfall City, Midrand."

The dish and wine pages are the long tail: 41 dishes and 10 wines, each an address of its own, each able to
answer a search for that dish in that area.

## What Mábu must do (about an hour, once the domain is live)

1. **Publish the site.** Upload `dist-web/` to the host, serving `/menu` from `menu.html` and
   `/events/<id>` from `events/<id>/index.html` (any static host does this; the check script
   `scripts/lib/web.mjs` shows the rule).
2. **Google Search Console** — search.google.com/search-console:
   - Add the property. Prefer the **Domain** property, verified by adding one TXT record at the domain
     registrar: it then covers www, non-www, http and https.
   - The alternative is the **HTML tag**: put the token in `EXPO_PUBLIC_GOOGLE_SITE_VERIFICATION` and export
     again; every page then carries it.
   - Submit the sitemap: **Sitemaps → `https://maburestaurant.com/sitemap.xml` → Submit**.
   - **URL Inspection → Request indexing** for the home page, `/menu`, `/book` and `/private-functions`.
3. **Bing Webmaster Tools** — bing.com/webmasters. Import the property from Search Console; it takes two
   minutes and covers Bing and Copilot.
4. **Google Business Profile** is worth more than the website for "restaurant near me" searches. Claim the
   listing, and make the name, address, phone number and hours match the website exactly.
5. **Confirm the public phone number.** The app hides every "Call" action while it is unknown, and the
   `Restaurant` schema leaves `telephone` out. Directory listings show a number for Mábu; Mábu should confirm
   the one to publish rather than us copying it.
6. **Ask for links** from the places that already list Mábu: Waterfall City, Waterfall Wilds, Eat Out,
   Dining-OUT, Tripadvisor, and any suppliers or wine estates featured at events. Local links are what move
   local rankings.

## After launch

- Watch **Search Console → Performance** for the searches that bring people in, and adjust the page titles to
  match the words they actually use.
- Every menu change is a content update: run `npm run export:web` again so the pages and sitemap follow.
- Each new event is a new page with its date and price in structured data — worth republishing the site when
  one is added.
- Consider a short page per occasion (birthdays, anniversaries, year-end functions) once there is real
  photography to go with it; those are searched heavily in Gauteng from October.

## Known trade-off

Pages are rendered at a default window size at build time, then again by the browser at the real size, so
React reports a hydration difference on layout that depends on the window. The page is correct either way: a
search engine reads the HTML, a guest sees the second render. The screen sweep counts these notices and fails
on anything else.
