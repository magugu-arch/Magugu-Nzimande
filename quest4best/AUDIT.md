# Quest4Best website — completion audit

Audited 27 September 2026 against the Claude Code brief (sections 1–22) and the CI/01 identity
sheet.

## Result: 80% complete — 20% remaining

Engineering is essentially done. Almost everything left needs **input or a decision from the
client**, not development time. Once those inputs arrive, the remaining build work is roughly
**3–5 hours**.

| Area                        | Weight | Done | Contributes |
| --------------------------- | -----: | ---: | ----------: |
| Build, design & engineering |    45% | 100% |         45% |
| Content & copy              |    20% |  80% |         16% |
| Brand assets                |    10% |  70% |          7% |
| Launch infrastructure       |    15% |  60% |          9% |
| Client review & device QA   |    10% |  30% |          3% |
| **Total**                   |        |      |     **80%** |

## Measured quality (Lighthouse 12, production build)

| Category       | Mobile | Desktop |
| -------------- | -----: | ------: |
| Performance    |     88 |      99 |
| Accessibility  |    100 |     100 |
| Best practices |     96 |      96 |
| SEO            |    100 |     100 |

The mobile performance figure was measured on a local server with no compression or caching.
GitHub Pages adds both, so the live score should be higher. The best-practices deduction is the
hero video failing to load inside the audit sandbox.

## Brief acceptance criteria (§22)

| #   | Criterion                         | Status  | Note                                                                                          |
| --- | --------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| 1   | Logo crisp and proportionate      | Partial | Correct proportions, but taken from the CI sheet raster; needs the vector master              |
| 2   | Hero fills the viewport           | Done    | `100svh`                                                                                      |
| 3   | Hero video with poster fallback   | Done    | Poster verified; video URL not reachable from the build sandbox, so check it on a real device |
| 4   | Navigation readable over video    | Done    | Gradient overlays, and a solid bar once scrolled                                              |
| 5   | Mobile menu works                 | Done    | Tested: opens, closes on link, Escape, and resize                                             |
| 6   | All anchor links work             | Done    | Home, Perspective, Expertise, About, Contact                                                  |
| 7   | Typography feels premium          | Done    | Inter, self-hosted                                                                            |
| 8   | Orange is restrained              | Done    | Labels, numbers, rules and the hero full stop only                                            |
| 9   | Photography coherent              | Done    | Monochrome people, warm-muted architecture                                                    |
| 10  | No excessive UI decoration        | Done    |                                                                                               |
| 11  | Credible to a CEO                 | Pending | Needs client review                                                                           |
| 12  | Mobile layout polished            | Done    | 390px verified, no horizontal scroll                                                          |
| 13  | `npm run build` passes            | Done    |                                                                                               |
| 14  | No TypeScript errors              | Done    | Strict mode                                                                                   |
| 15  | No missing asset paths            | Done    | Zero 4xx responses at root and under the Pages sub-path                                       |
| 16  | No placeholder text except marked | Done    | Email and domain are placeholders, both marked in code                                        |

## Done beyond the brief

- WCAG AA contrast on all text. Orange on off-white measures 3.2:1, so on light sections the
  small labels use ink and the orange numbers are set as large text.
- Keyboard: skip link, visible focus ring, logical tab order.
- Respects reduced-motion settings (video holds still), and the video pauses when off screen.
- Responsive WebP images with JPEG fallback, lazy-loaded below the fold.
- Open Graph and Twitter preview image (1200×630), JSON-LD, canonical URL, sitemap, robots.txt,
  web manifest, full icon set, 404 page.
- A deploy workflow to GitHub Pages (`.github/workflows/quest4best-pages.yml`).

## Remaining work

### Needs client input (blocks launch)

1. **Contact email.** Confirm `hello@quest4best.co.za` exists and is monitored. _(5 min once
   known: `src/content.ts`, `index.html`.)_
2. **Production domain.** Confirm `quest4best.co.za`. Then point DNS to the host and add the
   custom domain in Pages settings. _(1 h, plus DNS propagation.)_
3. **Vector logo master** (SVG, white and black versions) and the official favicon. _(30 min.)_
4. **Copy sign-off.** The client approves all copy. This includes whether to add verified career
   facts (McDonald's South Africa, Strathclyde) to the About section, and whether Mlungisi should
   be described as founder. _(30 min–1 h.)_
5. **Hero video.** Confirm usage rights, and preferably supply the file so it is hosted with the
   site rather than on a third-party CDN. _(30 min.)_

### Recommended before launch

6. **Privacy notice (POPIA).** The site collects no data and sets no cookies, but a short privacy
   statement with the registered company details (Quest4Best Consulting (Pty) Ltd, registration
   number) is good practice. _(30 min once the details are supplied.)_
7. **Real-device QA.** iOS Safari and Android Chrome, especially video autoplay. _(1 h.)_
8. **Higher-resolution portrait.** `mlungisi-portrait.jpg` is only 396px wide. It is currently
   unused, and is needed if a press or LinkedIn preview uses it.

### Optional

9. The photos the brief lists but that were never supplied (`city-buildings`, `modern-building`)
   have been substituted with `executive-window`. Swap them in if they arrive.
10. Privacy-friendly analytics (e.g. Plausible) if the client wants visitor numbers.
11. Replace the GitHub Pages URL with the custom domain in the deploy workflow environment.
