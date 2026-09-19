# releases

Built deliverables. **Everything in here is generated — never edit it by hand.**

## `pappas-app.html`

The whole app folded into one self-contained document: the JavaScript bundle,
all thirteen photographs and every font weight inlined as `data:` URIs. There
is nothing to serve and nothing to install — open it in a browser.

It is for sending the app to somebody who has no toolchain: an investor, a
reviewer, anyone with a browser and no Node on their machine.

### Regenerating it

```bash
EXPO_PUBLIC_USE_MOCK_API=1 npx expo export --platform web --output-dir .preview-web
npm run bundle:single
cp .preview-web/pappas-app.html releases/pappas-app.html
```

### What to say when you send it

- **It runs against the mock service layer**, not a backend. Orders it takes
  reach no kitchen.
- **Prices show as a dash**, because Pappas has not supplied them and the app
  refuses to invent them. That is the honest build, and the reason a dish
  cannot be added to a cart. `npm run audit:placeholders` lists what is
  outstanding.
- **The photographs are re-encoded smaller** than the store build ships, to
  keep the file sendable.
- **Deep links cannot work.** There is only one document, so the app opens at
  its own start and is navigated from there.
- **It is not the store build.** React Native Web is honest about layout,
  typography and flow, and silent about gesture, haptics, push and offline
  recovery.

### A note on committing it

This file is ~12 MB, and every rebuild committed here adds that much to the
repository's history permanently. It lives in git because a handover
deliverable somebody can clone and open is worth the weight. If it starts
being rebuilt often, move it to a release asset instead.
