# Test results

Run on 14 November 2026 with `tests/check.js` in Playwright's Chromium,
emulating each device's screen size, touch input and browser identity. These
are browser-engine checks, not physical phones: WebKit (Safari's engine) isn't
installed in the build environment, so check once on a real iPhone and a
lower-cost Android phone before a pitch.

| Build | Result |
| --- | --- |
| Single file, `Sundowns_One_Fan_App.html`, opened as a file | 24 of 24 pass |
| Hosted site, `site/`, served over HTTP | 26 of 26 pass |

## What's checked

| Area | Check |
| --- | --- |
| Every screen | All 23 screens at 390 px (iPhone 13), 320 px (small Android) and 1280 px (desktop): each renders, no sideways scrolling, every photo on it resolves, no script errors |
| Navigation | A deep link opens its screen; the planner pushes with a back button naming Matchday; Back returns there |
| Planner | Totals follow the inputs (crew of 4, parking shared: R385 each, R1,540 for the crew); the plan survives a reload |
| Sheets | A fixture sheet opens and makes the page behind inert; Escape closes it and frees the page; a downward flick on the grabber dismisses it |
| Passport | The club history quiz pays +20 points once |
| Consent | Message choices start off, nothing in the sheet is pre-ticked, and each change is recorded |
| Ask Sundowns | Answers cite a source; a refund question goes to a person; an unknown question gets "no checked answer" |
| Low-data mode | Photos are dropped |
| Accessibility settings | Dark mode follows the system; with Reduce Motion, screens change without sliding |
| JavaScript off | All 23 screens read in full (prerendered), as in iPhone Files or a WhatsApp document preview |
| Install (site only) | Manifest is served with `display: standalone` and 192 and 512 px icons |
| Offline (site only) | After one visit the service worker is in control; with the connection off, the app reloads and photos already seen still load |

Lint: `npx eslint sundowns-one` reports no errors or warnings with the repo's
configuration.

To run it again (set `PW_CHROMIUM` only if Playwright can't find its browser):

```sh
node tests/check.js Sundowns_One_Fan_App.html [screenshot-folder]
(cd site && python3 -m http.server 8765) &
node tests/check.js http://localhost:8765/ [screenshot-folder]
```
