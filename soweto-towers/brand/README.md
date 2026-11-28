# Soweto Towers: identity

## Start here: round 3

**`round-3/soweto-towers-identity-options.pdf`** (19 A4 landscape pages, also as
`round-3/index.html`) presents three standalone identities. Each one is shown complete: the
logo and how it is drawn, colour versions, the app icon, business cards, a voucher, the
website header, a social post and a wristband.

| # | Option          | Symbol and name                                                                                   |
| - | --------------- | ------------------------------------------------------------------------------------------------- |
| 1 | S + T monogram  | An S whose top stroke runs on as the T's crossbar (the bridge); the red stem is the drop. Name in plain capitals. |
| 2 | Two T's         | The name is the logo: both T's are drawn as cooling towers. The icon is the pair of tower-T's.    |
| 3 | The Loop        | The two rims seen from above, joined by the bridge, in one red line. Upright, it is an S (the app icon). Name in plain capitals. |

Each option folder (`round-3/option-N-*/`) holds `svg/` masters and `png/` exports:
`logo`, `logo-alt`, `logo-descriptor`, `symbol` (and `symbol-upright` for the Loop) in
`colour`, `reverse`, `black` and `white`, plus `app-icon`.

All three share one palette and one typeface, so the comparison is about the idea.

## Earlier rounds

- `options/`: round 2, the six logo options (with PDF).
- `archive/combined-identity/`: a combined system (two-T name + monogram + the Loop as a
  pattern) with a 20-page brand book. It was superseded when the Loop became its own option,
  but its pictograms, pattern and application layouts can carry over to whichever option is chosen.

## Colour

| Name         | HEX       | RGB          | CMYK         | Print          |
| ------------ | --------- | ------------ | ------------ | -------------- |
| Drop Red     | `#DA291C` | 218 41 28    | 0 95 100 0   | Pantone 485 C  |
| Tower Black  | `#151412` | 21 20 18     | 60 50 50 100 | Rich black     |
| Bone         | `#F3EFE7` | 243 239 231  | 3 4 8 0      | Natural white  |

Mural palette (codes activities): Highveld Sky `#1D5FD0`, Mural Gold `#F2B33D`, Kasi Green
`#1F8A5B` and Concrete `#8F8A82`. The CMYK values are starting points, so approve colour on a
printed proof.

## Type

[Archivo](https://fonts.google.com/specimen/Archivo) by Omnibus-Type, under the SIL Open Font
License 1.1. All lettering in the logo files is outlined.

## Rebuilding

Everything is generated from geometry in `source/`.

```sh
python3 -m venv .venv && .venv/bin/pip install -r source/requirements.txt
npm pack @fontsource-variable/archivo && tar -xzf fontsource-variable-archivo-*.tgz
FONT=package/files/archivo-latin-wdth-normal.woff2
.venv/bin/python source/r3.py      $FONT round-3                    /tmp/st-cache  # round 3
.venv/bin/python source/options.py $FONT options                    /tmp/st-cache  # round 2
.venv/bin/python source/ci.py      $FONT archive/combined-identity  /tmp/st-cache  # archive
```

PNGs and `favicon.ico` are rendered from the SVGs with headless Chromium and ImageMagick
(job lists in `/tmp/st-cache`). Each PDF is its `index.html` printed by Chromium with
`page.pdf({ preferCSSPageSize: true, printBackground: true })`.
