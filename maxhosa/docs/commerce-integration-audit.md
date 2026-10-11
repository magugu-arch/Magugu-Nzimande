# Commerce integration audit — discovery status

**Status: not started against the live store.** This file records what is
known, what could not be checked, and what discovery must answer before any
real adapter is written. It is the brief's §7 deliverable in its honest,
pre-discovery state.

## What was checked, and how

| Item | Result |
|---|---|
| `https://maxhosa.africa/` (storefront) | **Not reachable from the build environment** — the network policy denied the connection. No platform, API, theme or checkout was inspected. |
| Expo SDK 57 documentation (`docs.expo.dev`) | Also denied. The app was built against the installed SDK 57 packages' own type definitions and the existing bb.q app in this repository, which already runs on SDK 57. |
| Supplied brief (v1.2, 11 Oct 2026) | Read in full. Its observations about the store (Shopify-style collection URLs; Men, Women, Unisex, Accessories and Lifestyle; customer accounts; PayFast and cards in the FAQ; a 21-day return-request window and 30-day size exchanges) are **the brief's**, not verified here, and are deliberately **not** hard-coded anywhere in the app. |
| Image assets | The 24 images embedded in the brief's Appendix C were extracted and verified (count, uniqueness, integrity, hashes). They are 280–336 × 420 px previews; the full-resolution masters and their manifest folder were not supplied. |

## Assumptions the code does *not* make

- That the platform is Shopify. `CommerceProvider` is platform-neutral.
- Any price, stock level, lead time, policy period, delivery estimate,
  store address, opening hour or appointment slot. All are sample data,
  labelled as such, or come from a provider.
- That a courier supplies live coordinates. The tracker works with scan
  events alone and shows a map only when a position exists.

## Questions discovery must answer (from the brief §13)

1. Commerce platform, API access (Storefront / Customer Account / Admin), and
   who administers it.
2. Markets, currencies and shipping regions for the first release; how
   duties and taxes are presented per market (DDP or not).
3. Payment providers and methods per market; whether Apple Pay / Shop Pay are
   configured.
4. Where inventory, fulfilment, CRM, email/SMS/push, events and bookings live.
5. Approved collection stories, campaign images, logo, typefaces and cultural
   copy — and who reviews cultural content.
6. Appointment service model, locations, capacity and who owns the calendar.
7. Carriers and aggregators under contract; tracking API and webhook access;
   whether any same-day courier exposes positions; proof-of-delivery terms.
8. Ownership of support, returns/exchanges, privacy requests and measurement.

## If Shopify is confirmed

- Product/collection queries and cart via the Storefront API (versioned,
  generated types, GraphQL documents kept in one module).
- Customer Account API with OAuth + PKCE; tokens in Keychain/Keystore.
- Checkout via Checkout Kit or the checkout URL — no in-app payment form.
- Order and fulfilment events via webhooks to the integration service
  (signature-verified, idempotent, reconciled), never client polling.
- No Admin API credential in the app, ever.
