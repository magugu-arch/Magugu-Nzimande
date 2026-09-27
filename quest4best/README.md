# Quest4Best Consulting — website

The one-page site for Quest4Best Consulting. It is its own Vite + React + TypeScript + Tailwind
project, independent of the Expo app at the repository root.

```sh
cd quest4best
npm install
npm run dev      # local development
npm run build    # typecheck + production build into dist/
npm run build:html  # the whole site as one self-contained file in dist-html/
```

## Brand decisions

Colour and type follow the corporate identity specification (CI/01, v1.0) where it differs from
the written brief:

| Token   | Value     | Source                  |
| ------- | --------- | ----------------------- |
| `ink`   | `#0A0A0A` | CI/01 §05 Black         |
| `quest` | `#E4601F` | CI/01 §05 Orange        |
| `paper` | `#F4F3EF` | Brief §6 Warm Off-White |
| Font    | Inter     | CI/01 §06               |

## Before launch

- **Contact email** — `hello@quest4best.co.za` is a placeholder (`src/content.ts`). Confirm it.
- **Logo** — `src/assets/quest4best-logo.png (and the copy in public/assets used by link previews)` is taken from the reversed lockup on the CI sheet.
  Replace it with the vector master (SVG, white version) when it is supplied; the component
  (`src/components/Logo.tsx`) needs no other change.
- **Favicon** — `public/favicon.ico`, `favicon-32.png`, `apple-touch-icon.png` and `icon-*.png` are
  the "4" symbol from the CI sheet; regenerate them from the master.
- **Domain** — `DEFAULT_SITE_URL` in `vite.config.ts` (`https://quest4best.co.za`) is a placeholder.
- **Biography** — the About section uses only the working copy from the brief. Add verified
  career facts only once the client has approved them.
- **Hero video** — hosted on an external CDN (`HERO_VIDEO` in `src/content.ts`). Consider
  self-hosting before launch; the poster image keeps the hero usable if it fails.

## Request form

The Contact section's form works without a server: on submit it opens the visitor's mail app with
the request written out to `CONTACT_EMAIL`. To receive submissions directly, point
`VITE_FORM_ENDPOINT` at any service that accepts a JSON POST (Formspree, Web3Forms, Basin),
either in the build environment or in the deploy workflow's Build step. The form then posts and
shows an on-page confirmation.

## Deploy

`.github/workflows/quest4best-pages.yml` builds this folder and deploys it to GitHub Pages on
every push to the site branch. The build takes two variables:

- `BASE_PATH` — the sub-path the site is served from (`/Magugu-Nzimande/` on Pages, `/` on a
  custom domain).
- `VITE_SITE_URL` — the public URL, for canonical, Open Graph, `robots.txt` and `sitemap.xml`.

One-time setup (repository owner): Settings → Pages → Source: **GitHub Actions**, and allow the
site branch under Settings → Environments → `github-pages`.

See [AUDIT.md](AUDIT.md) for what remains before launch.

## Shareable single file

`share/quest4best-website.html` is the whole site in one file, with scripts, styles, the font
and every photo embedded, for review by email or opening from disk. Regenerate it with
`npm run build:html` and copy `dist-html/index.html` over it. Only the hero video still
streams from its CDN, and the poster shows when offline.

## Photography

| File                                       | Used in                                           |
| ------------------------------------------ | ------------------------------------------------- |
| `hero-business.webp`                       | Hero video poster                                 |
| `mlungisi-meeting.jpg`                     | 01 The Quest                                      |
| `mlungisi-standing.jpg`                    | 03 About                                          |
| `executive-window.jpg`, `meeting-warm.jpg` | Visual proof                                      |
| `mlungisi-chair.jpg`                       | 04 Contact                                        |
| `mlungisi-portrait.jpg`                    | Not yet placed — too small (396px) for layout use |
| `og-image.jpg`                             | Link previews (Open Graph / Twitter)              |

Every photo has a `.webp` twin (and a `-640.webp` for wide originals) served via `<picture>`.
