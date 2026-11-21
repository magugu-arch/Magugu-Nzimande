# Manual accessibility testing

Step-by-step manual checks for the Home Affairs One prototype: keyboard only, screen readers,
zoom and text size, contrast, reduced motion, narrow screens and touch-target size, with a template
for recording results. Automated checks (the ESLint `jsx-a11y` rules and the axe checks run by
`npm run test:e2e`) catch only part of what matters; these checks cover the rest.

Status: a test procedure. **WCAG 2.2 AA is a target for this prototype, not a claim.** No
accessibility audit has been carried out and no results are recorded here. The brief (§23) expects
an accessibility audit and testing with disabled people before any release; this runbook replaces
neither.

## Before you start

1. Build and serve what you are testing: `npm run build`, then `npm run preview`
   (`http://127.0.0.1:4173/`). Note the commit.
2. Reset the demo data so every tester starts from the same state (see `local-development.md`).
3. Open the accessibility settings (footer → "Accessibility settings") and confirm they are at
   their defaults: standard text, system contrast, system motion.
4. Record the device, operating system, browser and assistive technology, with versions.

### Journeys to cover

Run each check below across these journeys, as far as they exist in the build under test:

| #   | Journey                                                                                |
| --- | -------------------------------------------------------------------------------------- |
| J1  | Public: welcome page → find a service → read a service page (signed out)               |
| J2  | Sign in as a demo person → home                                                        |
| J3  | Start an application → save → resume → review → declaration → sandbox payment → submit |
| J4  | Open an application → read the status timeline → complete a requested action           |
| J5  | Find a service point (list and map views, filters) → book or change an appointment     |
| J6  | Messages: read an inbox message → change notification preferences                      |
| J7  | Help: request a call-back or make a complaint                                          |
| J8  | Profile: change text size, contrast and motion settings; sign out                      |
| J9  | Failure states: switch the simulated network to slow, offline and error, then retry    |
| J10 | Staff console and partner sandbox: sign in, open a queue, act on a case                |

## 1. Keyboard only

Put the mouse aside. Use Tab, Shift+Tab, Enter, Space, the arrow keys and Escape.

1. Load a page and press Tab once. A "Skip to main content" link appears; Enter moves focus to the
   main content.
2. Tab through the whole page. Every link, button and form control is reachable, in an order that
   matches the visual order. Nothing off-screen or hidden takes focus.
3. Focus is always visible: a clear ring on light and on dark surfaces (ribbon, footer, tab bar).
4. Activate every control with the keyboard alone. Radio groups and segmented controls move with
   the arrow keys; switches toggle with Space.
5. Follow a link to another page. Focus moves to the new page's main heading, not back to the top
   of the browser or lost in the footer.
6. Open any disclosure, menu or dialog. Escape closes it and focus returns to the control that
   opened it. Focus cannot wander behind an open dialog.
7. Submit a form with errors. Focus moves to the error summary or the first field in error, and
   each error is next to its field.
8. Nothing traps focus, and nothing happens on focus alone (no navigation or submission just from
   tabbing onto a control).
9. Trigger a loading, offline and error state (J9). The "Try again" control is reachable and works.

## 2. Screen readers

Test at least one desktop and one mobile combination. Suggested pairs:

| Screen reader | Platform and browser       | Start / stop                         | Useful commands                                                                  |
| ------------- | -------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| NVDA          | Windows, Firefox or Chrome | Ctrl+Alt+N / NVDA+Q                  | H next heading · D next landmark · F next form field · NVDA+F7 elements list     |
| VoiceOver     | macOS, Safari              | Cmd+F5                               | VO is Ctrl+Option · VO+U rotor · VO+Right/Left next/previous · VO+Space activate |
| VoiceOver     | iOS, Safari                | Settings → Accessibility → VoiceOver | Swipe right/left · double-tap to activate · rotor: rotate two fingers            |
| TalkBack      | Android, Chrome            | Settings → Accessibility → TalkBack  | Swipe right/left · double-tap to activate · reading controls: swipe up/down      |

For each journey:

1. **Page title and language.** The title names the page and says it is a concept. Speech uses an
   English (South Africa) voice.
2. **Concept ribbon.** It is announced as a note about the prototype, once, without blocking the
   page.
3. **Landmarks.** Banner, main navigation, main content and footer are present and named; the
   mobile tab bar is a separately named navigation.
4. **Headings.** One `h1` per page; levels do not skip. Listing headings gives a usable outline.
5. **Links and buttons.** Each makes sense out of context ("View application", not "Click here").
   The current page is announced in the navigation.
6. **Forms.** Every control announces its label, any hint, whether it is required, and its error.
   Grouped choices announce the group question.
7. **Status and progress.** Status tags are read as text. Timeline steps say whether they are done,
   current or still to come. Nothing depends on colour or position.
8. **Changes without a reload.** After saving, submitting, signing in, or a status update, a short
   message is announced without moving focus. Loading states are announced.
9. **Photographs.** Meaningful images have a short description; decorative ones are skipped. No
   information exists only inside an image.
10. **Unread counts and badges.** The count is spoken ("Messages, 2 unread"), not just shown.
11. **Mobile.** Swipe order matches the visual order; the fixed tab bar does not cover content or
    steal focus; touch-exploring finds every control.

## 3. Zoom and text size

1. **Browser zoom to 200%** on a 1280-pixel-wide window. All content and functions remain; no text
   is clipped, overlapped or cut off; no horizontal scrolling for ordinary text.
2. **Text-only zoom to 200%** (Firefox: View → Zoom → Zoom Text Only). Same expectations.
3. **In-app text size.** Set "Large", then "Larger" in the accessibility settings (112.5% and 125%
   of the base size). Repeat J1–J4. Reload: the choice is kept and applied before the page paints.
4. **Combined.** "Larger" plus 200% browser zoom on a phone-width window. Buttons wrap rather than
   truncate; the tab bar stays usable.
5. **Operating-system font size** on iOS and Android set to the largest ordinary size. Check
   whether the page respects it, and record what happens.

## 4. Contrast and colour

1. In-app contrast set to "More contrast": text, borders, focus rings and icons are stronger and
   nothing disappears.
2. Operating-system "Increase contrast" (macOS, iOS) or high-contrast text (Android): the page
   responds in the same way without the in-app setting.
3. Windows contrast themes (forced colours): controls keep visible boundaries, focus is visible,
   and icons that carry meaning remain visible. Record any failure — this mode has had no specific
   styling work.
4. Measure text contrast with a contrast tool on a sample of screens: body text, muted text, text
   on the ribbon and footer, status tags, button labels, placeholder and disabled states, and text
   over photographs.
5. View the status timeline, tags, form errors and charts in greyscale. Every meaning is still
   available from text or an icon.

## 5. Reduced motion

1. Turn on the operating-system setting (macOS and iOS "Reduce motion"; Windows "Animation effects"
   off; Android "Remove animations"). Reload and repeat J2–J4.
2. Separately, set the in-app motion setting to "Reduce" with the system setting off.
3. In both cases: no sliding, fading or parallax; loading indicators still show that something is
   happening; nothing flashes; no content relies on an animation to be understood.

## 6. Narrow screens (320 px)

1. In the browser's responsive mode set the viewport to 320 × 568 CSS pixels (equivalent to 400%
   zoom on a 1280-pixel window).
2. Every journey works in a single column with **no horizontal scrolling**, except content that
   genuinely needs two dimensions (a map or a wide data table), which scrolls inside its own
   region.
3. The ribbon, header and tab bar do not together hide the content or the focused control.
4. Long words, references (`CASE-DEMO-…`) and buttons wrap instead of overflowing.
5. Rotate a real phone to landscape and repeat J3.

## 7. Touch-target size

The project's target is 44 × 44 CSS pixels (`--touch-target`). WCAG 2.2 AA sets a lower minimum of
24 × 24 CSS pixels for most targets.

1. On a real phone, use each journey with a thumb. Note any control that is hard to hit or sits too
   close to another.
2. In developer tools, inspect a sample of controls — tab-bar items, icon-only buttons, checkboxes,
   radio buttons, switches, links in lists, "remove" and "close" controls — and record width and
   height.
3. Record anything under 44 pixels as a finding, and anything under 24 pixels as a blocker.
4. Check that links inside sentences have enough line spacing not to be confused with neighbours.

## Not covered here

The brief also lists switch control, captions and language switching. The prototype is in English
only and has no audio or video, so the last two cannot be tested yet. Switch access, voice control
and cognitive-load review need their own sessions, ideally with people who use them every day.

## Recording results

One row per check, per journey, per device. Copy the header for each session.

```text
Session: <date> · Tester: <name> · Build: <commit> · Flag profile: <prototype|pilot>
Device / OS: <...> · Browser: <...> · Assistive technology: <name and version, or "none">
```

| #   | Journey | Check (section and step) | WCAG criterion (if known) | Result (Pass / Fail / Not tested) | Severity | What happened, and where | Issue link |
| --- | ------- | ------------------------ | ------------------------- | --------------------------------- | -------- | ------------------------ | ---------- |
| 1   |         |                          |                           |                                   |          |                          |            |
| 2   |         |                          |                           |                                   |          |                          |            |
| 3   |         |                          |                           |                                   |          |                          |            |

Suggested severity scale (ours, to be agreed with whoever audits the product):

| Severity | Meaning                                                                     |
| -------- | --------------------------------------------------------------------------- |
| Blocker  | A person cannot complete the journey with this technology or setting        |
| Major    | The journey can be completed, but only with real difficulty or a workaround |
| Minor    | An irritation or inconsistency that does not stop or seriously slow anyone  |

Keep completed result sheets with the release notes for the build they describe. An empty or
missing sheet means "not tested", never "passed".
