# Integration status

Every connector the app needs, and how real it is. Labels follow the brief:
**mock** · **configured** · **verified in sandbox** · **production approved**.

As of this build, **everything is `mock`.** No credentials, platform access or
vendor approval exist yet, and the app refuses to start if an adapter other
than `mock` is requested (`src/providers/index.ts`) rather than quietly running
on sample data while looking live.

| Domain | Adapter in use | Status | What replaces it | Blocked on |
|---|---|---|---|---|
| Catalogue, variants, price, stock | `MockCommerceProvider` (shared `data/sample-catalogue.json`) | mock | Verified platform adapter — Shopify Storefront API if Shopify is confirmed | Platform confirmation, Storefront token, product data and image rights |
| Cart revalidation | `MockCommerceProvider.revalidateCart` | mock | Platform cart API | As above |
| Checkout and payment | `MockCommerceProvider.startCheckout` (simulated outcomes, idempotent) | mock | Platform checkout (Checkout Kit or checkout URL handoff). No in-app payment form, ever | Platform, payment providers per market, app-store review of the handoff |
| Orders | `MockCommerceProvider.listOrders` (in memory; sample order seeded) | mock | Customer Account API / orders endpoint | Account provider, OAuth client |
| Customer accounts | none — guest only | mock (not connected) | OAuth 2.0 + PKCE via the platform's customer-account API; tokens in Keychain/Keystore | Account provider decision |
| Delivery tracking | `MockDeliveryProvider` (carrier events go through the real normaliser) | mock | Integration service fed by the contracted carrier/aggregator's signed webhooks | Carrier contract, tracking API/webhook access |
| Live courier position | `MockDeliveryProvider` same-day mode, fixed demo route | mock | Contracted same-day courier location feed, only if one exists | Same-day courier contract, privacy review |
| Delivery preference changes | `MockDeliveryProvider.requestPreference` (acknowledges after a delay; refuses after cut-off) | mock | Carrier API via integration service | Carrier support for each option |
| Appointments | `MockBookingProvider` (sample slots, slot hold, idempotent) | mock | Booking provider via integration service | Booking system, locations, service list, capacity rules |
| Notifications | Preference switches stored on device; nothing sent; no OS permission requested | mock | Expo push via integration service, consent records server-side | Messaging provider, consent design, POPIA review |
| Store locator | Not built; Account says details come from verified data | — | Approved location data | Verified store list |
| Events / RSVP | Empty state | — | Event system | Event data source |
| CMS / editorial copy | Placeholder copy, labelled | mock | Approved CMS content, sanitised | Brand-approved copy and cultural review |
| Analytics | None | — | Consent-aware, PII-free event schema (see SECURITY_PRIVACY.md) | Analytics vendor, consent design |
| Images | 24 verified concept assets (preview resolution) | configured (concept) | Approved, full-resolution photography mapped to SKUs | Masters for the 24, brand approval, SKU mapping |

## How to move a connector up a level

1. Implement the provider interface in `src/providers/<domain>/` (no screen
   changes — screens only see the domain types in `src/domain/types.ts`).
2. Validate every external payload at the boundary (see `RawCarrierEventSchema`
   in `src/domain/delivery.ts` for the pattern).
3. Add the adapter name to `choose()` in `src/providers/index.ts`, behind its
   `EXPO_PUBLIC_*_PROVIDER` value.
4. Run against the vendor's sandbox; record the result here as **verified in
   sandbox** with the date and what was exercised.
5. **Production approved** needs brand sign-off, a security review and, for
   payments and personal data, the legal reviews in SECURITY_PRIVACY.md.
