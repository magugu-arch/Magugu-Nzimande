# Test results

Run on 2026-11-10 against `Kaizer_Chiefs_One_Concept.html` (built from commit shown on its About screen), opened from
disk (`file://`) with Playwright's Chromium using each device's screen size, touch input and browser
identity. **29 of 29 checks passed.**

WebKit (Safari's engine) is not available in the build environment, so the iPhone rows are Chromium
emulating an iPhone. The no-JavaScript rows stand in for iPhone Files and WhatsApp document previews
and Android's HTML viewer, which do not run scripts. Check once on a real iPhone and Android phone,
including opening it from a WhatsApp chat, before showing it to anyone.

| Where | Check | Result | Detail |
| --- | --- | --- | --- |
| File | self-contained (no external requests) | Pass | 1.48 MB |
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
