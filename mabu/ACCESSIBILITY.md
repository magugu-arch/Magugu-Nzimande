# Mábu: accessibility

What the app and the website do for guests who use a screen reader, a keyboard, larger text, or who cannot rely
on colour — and what is checked automatically. Written 29 September 2026.

## The standard we hold to

WCAG 2.1 AA, as far as it can be met in a React Native app and the same code served as a website. The build
fails on any **serious** or **critical** finding from axe-core; moderate and minor findings are listed for
judgement rather than enforced.

```
npm run export:web && npm run a11y
```

That runs axe-core in a real browser over a page of each kind — a list, a form, a picker, a document, a
photograph gallery, the staff tools — signed out, as a guest, and as staff. It is a step in CI.

## What is in place

- **Every control has a name.** The screen sweep fails on a button with no accessible name, at both 320 and
  390pt.
- **Photographs.** Each one is announced once, by the frame around it, in words written for that picture. A
  decorative texture is announced not at all and carries the empty `alt` the web asks for.
- **Roles that match behaviour.** A chip that filters is a toggle button (pressed or not); a tab is a tab
  inside a tab list; a time slot and a date are toggle buttons. A party-size stepper publishes its minimum,
  maximum and current value, and a progress bar says what it is progress towards.
- **Landmarks.** The body of every page is its `main` region and the top bar its `banner`, so a screen reader
  can skip straight to the content.
- **Keyboard.** A scrolling area with nothing focusable inside it — the gallery, a legal page, a rail of
  pictures — is itself a tab stop, so it can be read without a mouse.
- **Colour is never the only signal.** Links inside a sentence are underlined as well as brass; a reward above
  the guest's tier is marked by its badge, not only by a faded row.
- **Contrast.** Every text colour meets 4.5:1 on the ground it sits on. Two changes were needed: the board's
  copper (3.4:1 on charcoal) is lightened to 5.7:1 wherever it carries words, and "disabled" is now shown by a
  quieter surface rather than by fading a control to 40% opacity, which had taken one label to 1.5:1.
- **Reduced motion.** A guest who asks their browser or phone for less movement sees every page in full. This
  was a real bug, found by the sweep: entering animations left content hidden on the pre-rendered pages,
  including the "Book your table" button. Entering animations are now native-only and the sweep checks for it.
- **Touch targets** are at least 44pt, and the tab bar keeps its brass centre button reachable from every tab.
- **Text size.** The app uses the platform's own text scaling; nothing is pinned to a pixel height that would
  clip at larger sizes. Checked at 320pt width, the narrowest phone we support.

## Known and accepted

- **The bottom tab bar is not a `navigation` landmark.** It comes from the router's own tab navigator, so its
  labels sit outside a landmark. Every tab is still named and reachable; this is a moderate finding, not a
  barrier.
- **Hydration notices.** Pages are rendered to HTML at a default window size and rendered again at the real
  one, which React reports as a difference. The page is correct either way.
- **Not yet tested with real assistive technology.** axe-core finds what a machine can find. Before launch,
  half a day with VoiceOver on iOS and TalkBack on Android is worth more than any further automated pass.

## Before launch

1. Walk the booking journey end to end with VoiceOver and with TalkBack.
2. Check the app at the largest system text size on a small phone.
3. Ask somebody who uses a screen reader daily to book a table and tell us where it went wrong.
