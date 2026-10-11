# Offline demo — test results

Automated run on 2026-10-11 against `deliverables/MAXHOSA_AFRICA_App_Offline_Demo.html`
(1.30 MB), Chromium 141.0.7390.37, headless, **network disabled**
(every non-`file:`/`data:`/`blob:` request aborted and counted).

**74 of 74 checks passed.**

Re-run with `npm run demo:test`. Screenshots are written to `.offline-demo-shots/`.

## file

| Check | Result |
|---|---|
| no external src/href/url()/@import/script/link references | Pass |
| no ES-module scripts | Pass |
| Content-Security-Policy forbids network fetches | Pass |
| demo label present in markup | Pass |
| single file under 5 MB (1.30 MB) | Pass |

## phone 390×844

| Check | Result |
|---|---|
| loads with no console errors | Pass |
| no horizontal page scroll (0px) | Pass |
| demo label fully visible (not truncated) | Pass |
| every visible button has an accessible name | Pass |
| every image has an alt attribute | Pass |
| all 24 verified images decode (24/24) | Pass |
| no network requests attempted | Pass |

## small phone 320×640

| Check | Result |
|---|---|
| loads with no console errors | Pass |
| no horizontal page scroll (0px) | Pass |
| demo label fully visible (not truncated) | Pass |
| every visible button has an accessible name | Pass |
| every image has an alt attribute | Pass |
| all 24 verified images decode (24/24) | Pass |
| no network requests attempted | Pass |

## tablet 820×1180

| Check | Result |
|---|---|
| loads with no console errors | Pass |
| no horizontal page scroll (0px) | Pass |
| demo label fully visible (not truncated) | Pass |
| every visible button has an accessible name | Pass |
| every image has an alt attribute | Pass |
| all 24 verified images decode (24/24) | Pass |
| no network requests attempted | Pass |

## desktop 1280×900

| Check | Result |
|---|---|
| loads with no console errors | Pass |
| no horizontal page scroll (0px) | Pass |
| demo label fully visible (not truncated) | Pass |
| every visible button has an accessible name | Pass |
| every image has an alt attribute | Pass |
| all 24 verified images decode (24/24) | Pass |
| no network requests attempted | Pass |

## journeys (phone)

| Check | Result |
|---|---|
| Shop search finds "polo" (2 results) | Pass |
| Shop shows a no-results state | Pass |
| Product page has no preselected size | Pass |
| Add without a size explains what to do | Pass |
| Adding a sized piece updates the bag badge (badge 1) | Pass |
| Browser Back closes the product page | Pass |
| Shop filters persist after returning from a product | Pass |
| Swipe from the left edge pops the product page | Pass |
| Saved shows a saved piece | Pass |
| Bag opens with the line and sample totals | Pass |
| Bag is labelled demo — no real order or payment | Pass |
| Flicking the bag sheet down dismisses it | Pass |
| Failed payment has its own state and keeps the bag | Pass |
| Pending payment has its own state | Pass |
| Confirmed checkout creates exactly one new order (2 orders) | Pass |
| Confirmed order opens its delivery tracker | Pass |
| Tracker: no estimate before the courier has it | Pass |
| Tracker: no tracking reference before handover | Pass |
| Tracker: estimate is attributed to the courier once handed over | Pass |
| Tracker: scan-only shipment says location tracking is unavailable | Pass |
| Tracker: a delay withdraws the estimate | Pass |
| Tracker: a delay offers next steps | Pass |
| Tracker: an unknown courier event is not shown as a status | Pass |
| Tracker: same-day courier shows a map labelled as demo, not GPS | Pass |
| Tracker: stale location is flagged | Pass |
| Tracker: delivered state | Pass |
| Tracker: advance is disabled after delivery | Pass |
| Appointment: submitting empty shows inline errors | Pass |
| Appointment: enquiry is pending confirmation, not booked | Pass |
| Story copy is marked as an editorial placeholder | Pass |
| Changing market switches to that market’s sample prices (£435.00) | Pass |
| Product photo opens the zoom viewer | Pass |
| Dragging the photo down closes the viewer | Pass |
| External link explains it needs internet | Pass |
| Outbound links go only to maxhosa.africa, and only when chosen (https://maxhosa.africa/ — opened by the visitor, blocked by the test) | Pass |
| no console errors during the journeys | Pass |
| no network requests during the journeys | Pass |

## preferences

| Check | Result |
|---|---|
| Reduce Motion: screens still open (cross-fade, no slide) | Pass |
| Reduce Motion: no errors | Pass |
| Dark mode follows the system setting (rgb(16, 14, 11)) | Pass |
| Storage denied: the demo still runs from memory | Pass |

## Real-device and real-app checks — not yet performed

The automated run uses desktop Chromium emulating phone and tablet viewports
(touch enabled for the phone/tablet runs; gestures driven by a mouse pointer).
The checks below need a person and real hardware and have **not** been done
in this environment:

| Check | Status |
|---|---|
| macOS: double-click in Finder opens in Safari / Chrome | Not tested |
| Android: open from Files → Downloads in Chrome (Samsung, Pixel file managers) | Not tested |
| iPhone: open from the Files app in Safari | Not tested |
| WhatsApp: send as Document, download, open in a browser | Not tested |
| Touch feel of sheets, back-swipe and pinch-zoom on a real phone | Not tested |
| VoiceOver (iOS) and TalkBack (Android) walkthrough | Not tested |
| Dynamic Type / Android font scale at the largest setting | Not tested |
