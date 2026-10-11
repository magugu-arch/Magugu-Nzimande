# Interaction and visual design

The brief asks for editorial quiet luxury; the request to build it “Apple
style” sets how it should move and feel. Both apps — the native build and the
offline demo — follow the same rules, taken from Apple's WWDC design talks
(chiefly *Designing Fluid Interfaces*, 2018) and translated where needed.

## Motion: springs, in Apple's terms

Springs are specified by **damping ratio** and **response**, converted
exactly to physics (`src/design/motion.ts`; the demo's `02-motion.js` uses the
same formula):

| Name | Damping | Response | Used for |
|---|---|---|---|
| settle | 1.0 | 0.38 s | Anything that moved without being thrown |
| thrown | 0.86 | 0.32 s | A sheet or card released with speed |
| snappy | 1.0 | 0.26 s | Badges, press release |
| press | 1.0 | 0.18 s | Press-down feedback |

Bounce appears only after a flick. A screen that simply opened never
overshoots.

## The rules, and where they live

| Principle | In the app |
|---|---|
| **Respond on touch-down** | `PressableScale` sinks the instant a finger lands; the demo does the same with a pointer-down class that follows the finger with 10 px of slop |
| **1:1 tracking** | Sheets, back-swipe, toasts and the photo viewer follow the finger exactly; the demo's drags capture the pointer only after a small hysteresis |
| **Interruptible** | Every animation re-targets from its current value and velocity; a sheet can be caught mid-flight; the native stack's back-swipe can be grabbed mid-transition |
| **Velocity hand-off** | Each release passes its velocity to the spring that finishes the motion |
| **Momentum projection** | `project(v) = (v/1000)·d/(1−d)` chooses where a flick lands — dismiss or stay, pan target in the viewer |
| **Rubber-banding** | Past a boundary the content resists progressively (sheet tops, zoom limits, toast) |
| **2D as two springs** | The courier marker and the photo viewer move on independent X and Y springs |
| **Spatial consistency** | Sheets rise and leave downward; pushed screens arrive and leave on the right |
| **Materials** | Tab bar, headers and action bars are translucent; a header's material appears only once content scrolls under it (no permanent divider) |
| **Dim to focus** | Sheets dim and scale back what is behind them; stacked sheets scale back their parent |
| **Multimodal feedback** | Haptics only at meaningful moments (add to bag, error, selection), on the same frame as the visual change |
| **Typography** | Size-specific tracking (display −0.6, eyebrow +1.3), weight for emphasis, system font for UI, respects text size |
| **Forgiveness over confirmation** | Removing from the bag or Saved happens at once with Undo |
| **Reduced motion** | Slides and springs become cross-fades; the press scale is dropped |
| **Reduced transparency / contrast** | Materials become solid; hairlines darken (demo) |

## Visual tokens — provisional, for concept approval

Warm ivory paper `#F6F1E8`, ink `#16130F`, graphite text, one ochre `#85590F`
used sparingly, and green, rust and cobalt drawn from the knit for status.
Every text/background pair meets WCAG 2.2 AA in light and dark; the test
suite measures them. Display type is Playfair Display (OFL) standing in for
the brand's editorial face. The wordmark is typeset text standing in for the
approved logo, which was not supplied — no logo was drawn.

## What is the platform's, not ours

On iOS the sheets are `UISheetPresentationController` and the back gesture is
`UINavigationController`'s — they already embody these principles, so the app
uses them rather than re-implementing them. The offline demo, having no
native layer, implements them itself in plain JavaScript (`demo/js/02-motion.js` and `03-layers.js`).
