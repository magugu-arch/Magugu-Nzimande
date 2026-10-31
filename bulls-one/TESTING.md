# Device test results

Run on 31 October 2026 (re-run after adding parallax) with Playwright's Chromium, emulating each device's screen, touch input and browser identity. WebKit (Safari's engine) is not installed in the build environment, so iPhone results are emulated in Chromium; check once on a real iPhone before a pitch.

| Where | Check | Result | Detail |
| --- | --- | --- | --- |
| iPhone · Safari (hosted link) | 12 screens route, all images show, no sideways scroll | Pass | 0 errors |
| iPhone · Safari (hosted link) | WhatsApp share link carries the app link | Pass | https://wa.me/?text=Bulls One — The Loftus Experience (concept prototype) https://claude.ai/artifact/SZ2ZYsZXF |
| iPhone · Safari (hosted link) | Download the app file | Pass | Bulls_One_Loftus_Experience.html · 4.37 MB |
| iPhone · Files / WhatsApp document (no JavaScript) | All screens, images and fixtures readable | Pass | 12 screens · 52/52 images · 14 fixtures · points to https://claude.ai/artifact/SZ2ZYsZXFVykdLkdVtqs91 |
| Android · Chrome (hosted link) | 12 screens route, all images show, no sideways scroll | Pass | 0 errors |
| Android · Chrome (hosted link) | Web app manifest with home-screen icons | Pass | {"name":"Bulls One","display":"standalone","icons":true,"sizes":"192x192,512x512,512x512"} |
| Android · Chrome (hosted link) | Works offline after first visit (service worker) | Pass | controlled=true · offline reload: "Asset library · Bulls One — The Loftus Experience", 12 images |
| Android · Chrome (hosted link) | Download the app file | Pass | Bulls_One_Loftus_Experience.html · 4.37 MB |
| Android · WhatsApp document opened in Chrome (file) | Interactive app from the file, offline | Pass | all screens interactive; download button hidden (already the file) |
| WhatsApp · in-app browser (Android WebView) | Screens route and Fan Cam flow responds | Pass | Step 2 of 5 · Moment |
| claude.ai viewer (published page) | Download goes through the viewer’s downloads capability | Pass | Bulls_One_Loftus_Experience.html · 4.36 MB · [object Blob] |
| claude.ai viewer (published page) | Calendar offers Google Calendar; hides .ics the viewer blocks | Pass | {"google":true,"ics":false} |

Also checked: every screen at 320 px to 1440 px wide with no sideways scrolling, the full Fan Cam → moderation → big-screen flow, reduced motion, and a strict content-security policy (no missing images, no errors).

## Parallax

23 of 23 checks pass (desktop with a mouse, phone with touch, Reduce Motion):

- The home and live hero photos move at a third of the scroll speed. They ease in over the first 160 px, so there is no jolt at the top, and the photo's top edge always stays off screen.
- Card photos drift up to 7% of the card's height as the card crosses the screen. Story photos slide up to 6% of the card's width as the rail scrolls. At every scroll step on 8 screens, each photo still covers its frame.
- With a mouse, the home hero leans up to 12 × 8 px away from the pointer on a critically damped spring, then settles back when the pointer leaves. Touch screens don't lean.
- Reduce Motion: nothing moves. Switching the setting while the app is open turns parallax on or off and clears every offset.
