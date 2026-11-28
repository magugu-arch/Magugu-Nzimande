# Soweto Towers: corporate identity

## Start here

- **`soweto-towers-identity.pdf`**: the brand book, 20 A4 landscape pages, ready to send.
- **`index.html`**: the same book as one self-contained web page. The pages scale to the
  window, and printing from Chromium gives the same PDF.

## The system

Three parts, drawn with one line and a single red kept for the drop:

| Part         | What it is                                                                                      | Use it for                                   |
| ------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------- |
| The name     | SOWETO TOWERS, with both T's drawn as cooling towers (waist, flared base, crossbar on the rim).  | Every lockup; sign-offs; narrow spaces.     |
| The monogram | An S whose top stroke runs on as the T's crossbar (the bridge). The red stem is the drop.       | App icon, favicon, stamps, embroidery.      |
| The Loop     | The two rims seen from above, joined by the bridge. Upright, it is an S.                         | Pattern, stamps, frames, motion. Never a logo. |

Lockups: `horizontal` (primary), `stacked`, `stacked-descriptor`, `monogram`, `name`, plus the
Loop as `loop` and `loop-upright`. Each comes in four colourways: `colour` (light backgrounds),
`reverse` (dark), `black` and `white` (one colour).

## Files

| Folder         | Contents                                                                      |
| -------------- | ----------------------------------------------------------------------------- |
| `logo/svg/`    | Vector masters. Use these wherever possible.                                  |
| `logo/png/`    | Transparent PNGs (lockups 2400 px wide, monogram 1024 px).                    |
| `icons/`       | App icon (1024, 512, 192, maskable), Apple touch icon, `favicon.ico` and an adaptive `favicon.svg`. |
| `pictograms/`  | Six activity pictograms (bungee, SCAD freefall, zipline, paintball, BASE jump, viewing deck), colour and reverse. |
| `pattern/`     | Seamless Loop pattern tiles.                                                  |
| `options/`     | Round 2: the six logo options this identity was chosen from, with their PDF. |
| `source/`      | The code that draws everything.                                               |

For the website `<head>`:

```html
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
```

## Colour

| Name         | HEX       | RGB          | CMYK         | Print          |
| ------------ | --------- | ------------ | ------------ | -------------- |
| Drop Red     | `#DA291C` | 218 41 28    | 0 95 100 0   | Pantone 485 C  |
| Tower Black  | `#151412` | 21 20 18     | 60 50 50 100 | Rich black     |
| Bone         | `#F3EFE7` | 243 239 231  | 3 4 8 0      | Natural white  |

Mural palette (codes activities on the website, wristbands and signs): Highveld Sky `#1D5FD0`
(SCAD freefall, BASE), Mural Gold `#F2B33D` (zipline), Kasi Green `#1F8A5B` (paintball) and
Concrete `#8F8A82` (viewing deck, info). The CMYK values are starting points, so approve
colour on a printed proof.

## Type

[Archivo](https://fonts.google.com/specimen/Archivo) by Omnibus-Type, under the SIL Open Font
License 1.1. The name is artwork (Archivo Medium, width 118, tracked, with drawn tower T's).
Headlines use width 104 at weight 600, and text uses width 100 at weights 400 and 500.

## Rebuilding

Everything is generated from geometry in `source/`: `ci_assets.py` (monogram, Loop,
pictograms), `kit.py` (type as outlines, tower T's), `vec.py` (stroke outlining with Skia
PathOps) and `ci_book.py` (the brand book).

```sh
python3 -m venv .venv && .venv/bin/pip install -r source/requirements.txt
npm pack @fontsource-variable/archivo && tar -xzf fontsource-variable-archivo-*.tgz
FONT=package/files/archivo-latin-wdth-normal.woff2
.venv/bin/python source/ci.py      $FONT .        /tmp/st-cache   # identity + brand book
.venv/bin/python source/options.py $FONT options  /tmp/st-cache   # round-2 options
```

The PNGs and `favicon.ico` are rendered from the SVGs with headless Chromium and ImageMagick
(job list: `/tmp/st-cache/ci-jobs.json`). The PDF is `index.html` printed by Chromium with
`page.pdf({ preferCSSPageSize: true, printBackground: true })`.
