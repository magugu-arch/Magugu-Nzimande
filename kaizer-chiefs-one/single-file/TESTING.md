# Test results

Run on 2026-11-11 against `Kaizer_Chiefs_One_Concept.html`, opened from disk (`file://`) with Playwright's
Chromium using each device's screen size, touch input and browser identity.
**43 of 43 checks passed.**

WebKit (Safari's engine) is not available in the build environment, so the iPhone rows are Chromium
emulating an iPhone. The no-JavaScript rows stand in for iPhone Files and WhatsApp document previews
and Android's HTML viewer, which do not run scripts. Check once on a real iPhone and Android phone,
including opening it from a WhatsApp chat, before showing it to anyone.

| Where | Check | Result | Detail |
| --- | --- | --- | --- |
| File | self-contained (no external requests) | Pass | 1.49 MB |
| File | link-preview tags | Pass |  |
| File | image register embedded | Pass | 9 images |
| File | kept out of search engines | Pass |  |
| File | preview image under WhatsApp’s 300 KB | Pass | 189 KB |
| iPhone · file (JS on) | all 24 screens route, show images, no sideways scroll | Pass |  |
| iPhone · file (JS on) | segmented control switches and its marker follows | Pass | {"visible":true,"markerAt":159,"btnAt":159} |
| iPhone · file (JS on) | home/away filter | Pass | 2 away fixtures |
| iPhone · file (JS on) | Home → Squad quick link opens the squad | Pass |  |
| iPhone · file (JS on) | Fan Moment consent gates Continue | Pass |  |
| iPhone · file (JS on) | submitted moment shows in My moments, pending review | Pass |  |
| iPhone · file (JS on) | report sheet opens and a downward flick dismisses it | Pass |  |
| iPhone · file (JS on) | entry code shows the DEMO placeholder and an honest notice | Pass |  |
| iPhone · file (JS on) | privacy choice is remembered on this device | Pass |  |
| iPhone · file (JS on) | read all clears the unread badge | Pass |  |
| iPhone · file (JS on) | save button hidden when opened as the file itself | Pass |  |
| iPhone · file (JS on) | no script or console errors | Pass |  |
| iPhone · file (JS on) | opened straight at a screen, the concept strip is the first thing in view | Pass |  |
| Parallax · phone (touch) | hero photo moves at about a third of the scroll speed and always covers its frame | Pass | offsets 0, 11, 49, 94, 128 px |
| Parallax · phone (touch) | story photos slide as the rail scrolls and always cover their cards | Pass | up to 17.0 px |
| Parallax · phone (touch) | card photos drift as cards cross the screen and always cover their frames | Pass | up to 15.1 px |
| Parallax · phone (touch) | touch screens do not lean | Pass |  |
| Parallax · phone (touch) | Reduce Motion switched on while open clears every offset; off again restores them | Pass | after: 119 px |
| Parallax · phone (touch) | no script errors | Pass |  |
| Parallax · Reduce Motion from the start | nothing moves | Pass |  |
| Parallax · desktop with a mouse | hero leans away from the pointer, within 12 × 8 px, still covering its frame | Pass | 11.4 × 7.6 px |
| Parallax · desktop with a mouse | the lean eases in on a spring (part-way after 140 ms) | Pass | 7.3 px on the way to 11.4 |
| Parallax · desktop with a mouse | reversing the pointer redirects the lean from where it is | Pass | 11.4 → 4.1 → -11.4 px |
| Parallax · desktop with a mouse | leaving the hero settles the photo back | Pass |  |
| Parallax · desktop with a mouse | on all 24 screens, scrolled, every photo covers its frame | Pass |  |
| Parallax · desktop with a mouse | no script errors | Pass |  |
| Android · Chrome file (JS on) | all 24 screens route, show images, no sideways scroll | Pass |  |
| Android · Chrome file (JS on) | no script or console errors | Pass |  |
| 320 px phone (JS on) | all 24 screens route, show images, no sideways scroll | Pass |  |
| 320 px phone (JS on) | no script or console errors | Pass |  |
| No JavaScript · iPhone width | every screen readable, one after another | Pass | 24/24 screens |
| No JavaScript · iPhone width | every image shows | Pass | 39 image blocks, 0 missing |
| No JavaScript · iPhone width | no sideways scroll | Pass | 0px |
| No JavaScript · iPhone width | demo ticket placeholder shown, never a code | Pass |  |
| No JavaScript · 320 px | every screen readable, one after another | Pass | 24/24 screens |
| No JavaScript · 320 px | every image shows | Pass | 39 image blocks, 0 missing |
| No JavaScript · 320 px | no sideways scroll | Pass | 0px |
| No JavaScript · 320 px | demo ticket placeholder shown, never a code | Pass |  |

Rerun with `node single-file/tests/check.mjs` from `kaizer-chiefs-one/`. CI runs the same checks on
every change to the workspace.

## claude.ai Artifact

Checked once before publishing, inside a local copy of the viewer's page skeleton with a stand-in
for the viewer's `downloads` capability, at phone and desktop width: the page renders in the dark
scheme with no sideways scroll, 12 screens route, parallax runs, and **Save this file** passes the
1.56 MB standalone file to the viewer's save prompt. After publishing, the artifact's file list
showed both the page and the standalone file. Not exercised: the real save prompt in claude.ai,
which only appears for a person using the page.

## Expo app parallax

Probed once in the app's web build (390 × 844): on Home the hero photo sat 64 px back at 200 px of
scroll and 115 px at 360 px (0.32×), story photos slid from 0 / −16.8 / −16.8 px to
16.8 / −3.4 / −16.8 px after the rail scrolled 250 px, and with Reduce Motion every offset stayed 0.
The 30-route screen sweep still passes at 390 and 320 pt. Native iOS and Android builds were bundled
but not run on a device.
