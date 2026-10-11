# Product scope

**Promise:** “A considered way to discover, wear and experience MAXHOSA AFRICA.”

This build is the concept prototype of Phase 1 (core commerce MVP) plus the
parts of Phase 2 the brief asks to demonstrate early (appointment enquiry,
delivery tracking with a simulated same-day courier, and events with RSVP).
Everything runs on typed mock providers until discovery confirms the real
platforms. How far this is from a store-ready app, and what finishing it
costs, is in [COMPLETION_AUDIT.md](COMPLETION_AUDIT.md).

## In this build

| Area | What exists | Honest limits |
|---|---|---|
| Navigation | Home · Shop · Discover · Saved · Account; bag and search in every header | — |
| Home | Campaign hero, order status card, categories, new arrivals, journal, styling, available now | Campaign copy is the brief's promise line; collection names are not invented |
| Shop | Search (name, code, category, colour), category, size-available, colour, availability, price band per market, sort; filters persist across product visits | Price bands are sample ranges shared with the offline demo |
| Product | Gallery with pinch/double-tap zoom, sample tags, price per market, style code, size selector with **no preselection**, per-size availability, size guide (cm/in), delivery & returns summary linking to live policies, ask a stylist, share, curated pairings | Material, care, origin intentionally absent — never inferred from imagery |
| Saved | Wishlist, restock requests (device-only) | No cross-device sync until accounts exist |
| Bag & checkout | Lines, quantity, remove with Undo, sample subtotal in integer minor units, delivery/duties “from checkout”, revalidation, idempotent simulated handoff with confirmed / pending / failed / cancelled states | No payment form by design; demo labels throughout |
| Orders & tracking | Order list; tracker with attributed estimates, merchant vs courier events, exception recovery, unknown-event handling, scan-only and same-day modes, stale positions, delivery preferences with acknowledgement and cut-off, presenter controls | All simulated; “Demo location — not GPS” |
| Appointments | Service, day, time (sample availability, SAST with local-time conversion), contact details with inline validation, idempotent request, pending-confirmation result | Never “booked”; calendar add only after confirmation |
| Events and fixtures | Home's next fixture; Discover's next three; events calendar (month grid in SAST, swipe between months, city filter, upcoming/past, tap a day); event page with the shoppable event edit, reminder, local time, place type only; RSVP sheet (going / waitlist / invitation requested; drop-in needs none); add to calendar; invite a friend; release with Undo; “Wear it to…” on product pages; My events; “shop the looks” after the night | Sample fixtures, labelled; never a head-count or “only N left”; venues go to confirmed guests only; following fixtures is marketing and needs consent |
| Account | Guest state, orders, appointments, my events, market, size profile, notifications (all off; explained before on; marketing separate), appearance, “what is real” | No sign-in, data export or deletion until the account provider exists |
| Offline demo | Single HTML file covering all of the above, with `.ics` calendar files and a copyable invite | Preview-resolution images |

## Not in this build (and why)

- **Store locator, message centre** — need verified data sources; screens
  say so instead of inventing addresses.
- **Events back-office** — who creates fixtures, sets capacity and approves
  invitations; the app shows sample fixtures until it exists.
- **Web storefront (Next.js) and admin console** — the brief makes both
  conditional; the Expo app already renders on web for review.
- **Localisation beyond English** — requires professional translation.
- **Live Activities** — native iOS work once tracking is real; Home's order
  card is the in-app stand-in.

See `TASK_BOARD.md` for the phased plan and checklist.
