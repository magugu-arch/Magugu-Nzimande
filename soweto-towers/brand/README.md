# Soweto Towers: logo and identity

## Start here

- **`options/index.html`** has six logo options (round 2), side by side, with a recommendation.
  Each option has its own folder of SVG and PNG artwork.
- **`options/soweto-towers-logo-options.pdf`** is the same presentation as a 10-page A4
  landscape PDF, ready to send.
- **`index.html`** has the full guidelines for option 01, The Jump, which is already built
  out as a complete system. Its files are in `logo/` and `icons/`.

Both pages are self-contained, so they work offline and can be emailed as single files.

## The six options

| #  | Option          | Idea                                                                                       |
| -- | --------------- | ------------------------------------------------------------------------------------------ |
| 01 | The Jump        | The two towers and the bridge, with the cord and jumper as the only colour.                |
| 02 | S + T monogram  | An S whose top stroke runs on as the T's crossbar (the bridge). The red stem is the drop.  |
| 03 | Two T's         | A logotype: the two T's in "Soweto Towers" are drawn as cooling towers.                    |
| 04 | The Arch        | A red arc (the sun, or the O of Soweto) rises over the towers.                             |
| 05 | The Seal        | A heritage badge with the name around the ring and the towers at the centre.               |
| 06 | Skyline         | One continuous line traces both towers, from horizon to horizon.                           |

Recommended: option 01's symbol with option 03's two-T name (`options/recommended/`).

Every option uses the same colours and typeface, so the comparison is about the idea.

## Colour

| Name         | HEX       | RGB          | CMYK         | Print          |
| ------------ | --------- | ------------ | ------------ | -------------- |
| Drop Red     | `#DA291C` | 218 41 28    | 0 95 100 0   | Pantone 485 C  |
| Tower Black  | `#151412` | 21 20 18     | 60 50 50 100 | Rich black     |
| Bone         | `#F3EFE7` | 243 239 231  | 3 4 8 0      | Natural white  |

Secondary (mural palette, for coding activities): Highveld Sky `#1D5FD0`, Mural Gold
`#F2B33D`, Kasi Green `#1F8A5B` and Concrete `#8F8A82`. The CMYK values are starting
points, so approve colour on a printed proof.

## Type

[Archivo](https://fonts.google.com/specimen/Archivo) by Omnibus-Type, under the SIL Open Font
License 1.1. The name is set at width 118, weight 500, in capitals with +20% tracking.
Headlines use width 104 at weight 600, and text uses width 100 at weights 400 and 500.
The lettering in the logo files is outlined, so no font needs installing.

## Rebuilding

Everything is drawn in code from the geometry in `source/`: true hyperboloid towers, with
every measure a ratio of one unit.

```sh
python3 -m venv .venv && .venv/bin/pip install -r source/requirements.txt
npm pack @fontsource-variable/archivo && tar -xzf fontsource-variable-archivo-*.tgz
FONT=package/files/archivo-latin-wdth-normal.woff2
.venv/bin/python source/build.py   $FONT .         /tmp/st-cache   # option 01 system + guidelines
.venv/bin/python source/options.py $FONT options   /tmp/st-cache   # the six options
```

The PNGs and `favicon.ico` are rendered from the SVGs with headless Chromium and
ImageMagick, using the job lists written to `/tmp/st-cache`. `options.py` also writes
`/tmp/st-cache/options-print.html`, which headless Chromium prints to the PDF deck
(`page.pdf({ preferCSSPageSize: true, printBackground: true })`).
