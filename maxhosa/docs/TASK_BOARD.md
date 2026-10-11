# Task board and implementation status

## Phase 0 — Discovery (not started; needs the brand)

- [ ] Commerce platform audit (see `commerce-integration-audit.md` — the
      storefront was unreachable from the build environment)
- [ ] Markets, currencies, duties/taxes model, payment methods per market
- [ ] Carrier/aggregator contracts, tracking API and webhook access, same-day courier
- [ ] Booking system, locations, service list, capacity
- [ ] Brand assets: logo, typefaces, guidelines, **full-resolution masters of the 24 images**, SKU mapping
- [ ] Approved collection and cultural copy, and its reviewers
- [ ] Customer and staff research; costed backlog; risk register

## Phase 1 — Core commerce MVP (concept build: done on mocks)

- [x] Design tokens (provisional), motion system, components
- [x] Five-tab navigation, persistent bag and search
- [x] Home, Shop (search, filters, sort, persistence), Product detail
- [x] Saved, restock requests (device-only)
- [x] Bag, revalidation, idempotent checkout handoff with four outcome states
- [x] Orders and scan-based delivery tracker with exceptions and unknown events
- [x] Account: guest, market, sizes, notifications, appearance
- [x] Loading, empty, error states on data screens
- [x] Offline single-file demo, ZIP, README; Chromium test with network cut
- [x] Asset gate for the 24-image allowlist
- [ ] Real platform adapter, accounts, orders (blocked on Phase 0)
- [ ] iOS simulator and Android emulator runs; real-device checks
- [ ] Screen reader (VoiceOver/TalkBack) and largest-text walkthroughs on device
- [ ] App-store metadata, privacy/data-safety declarations (do not submit without brand approval)

## Phase 2 — Clienteling and engagement

- [x] Appointment enquiry flow (sample availability, idempotent, pending only)
- [x] Same-day courier map mode, stale positions, delivery preferences with acknowledgement (simulated)
- [ ] Booking provider integration with server-side slot locking
- [ ] Store locator from verified data; events and RSVP
- [ ] Secure message centre; push notifications with consent records
- [ ] iOS Live Activity for delivery progress

## Phase 3 — Global optimisation

- [ ] Market-aware checkout, localisation (professional translation)
- [ ] Multi-carrier tracking, proof-of-delivery handling
- [ ] Curated outfits, personalisation, evaluated 3D/AR

## Verification log (this build)

| Check | Result |
|---|---|
| `npm run assets:verify` | 24 unique assets, whole and in step |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | 59 / 59 |
| `npm run shots:web` (15 routes via react-native-web) | 15 / 15 clean |
| `npm run demo:test` (offline demo, Chromium, network cut) | 73 / 73 |
| Root bb.q app: typecheck, lint, format, 891 tests | Pass, unchanged |
| iOS / Android native builds | Not run in this environment |
