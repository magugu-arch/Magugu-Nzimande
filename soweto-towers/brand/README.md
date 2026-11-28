# Soweto Towers: logo and identity

Open `index.html` in a browser for the full guidelines: the idea, construction, lockups,
colour, type, clear space, applications and misuse. The page is self-contained, so it
works offline and can be emailed as one file.

## The idea

The mark shows the two Orlando cooling towers as true hyperboloids. The suspension bridge
across their tops forms the crossbar of a **T**, and the 100 m bungee drop from that bridge
forms its stem. One cut width separates every part, and that cut is what draws the T. It
reads as a landmark, a letter and a leap.

## Files

| Folder       | What                                                                   |
| ------------ | ---------------------------------------------------------------------- |
| `logo/svg/`  | Vector masters. Use these wherever possible.                           |
| `logo/png/`  | Transparent PNGs: lockups 2400 px wide, mark 1024 px, small mark 256 px. |
| `icons/`     | App icon (1024, 512, 192, maskable), Apple touch icon, favicon `.ico` and `.svg`. |
| `source/`    | The generator that draws everything from the geometry.                 |

Lockups: `horizontal` (primary), `stacked`, `stacked-descriptor`, `mark`, `wordmark`, and
`mark-small` (a master for 16–40 px with wider cuts).

Colourways: `colour` for light backgrounds, `reverse` for dark backgrounds, and `black` and
`white` for one-colour use.

For the website `<head>`:

```html
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
```

`favicon.svg` switches the towers to Bone when the browser is in dark mode.

## Colour

| Name         | HEX       | RGB          | CMYK         | Print          |
| ------------ | --------- | ------------ | ------------ | -------------- |
| Drop Red     | `#DA291C` | 218 41 28    | 0 95 100 0   | Pantone 485 C  |
| Tower Black  | `#151412` | 21 20 18     | 60 50 50 100 | Rich black     |
| Bone         | `#F3EFE7` | 243 239 231  | 3 4 8 0      | Natural white  |

Secondary (mural palette, for coding activities): Highveld Sky `#1D5FD0` for SCAD and BASE,
Mural Gold `#F2B33D` for zipline, Kasi Green `#1F8A5B` for paintball, and Concrete `#8F8A82`
for the viewing deck and information. The CMYK values are starting points, so approve
colour on a printed proof.

## Type

[Archivo](https://fonts.google.com/specimen/Archivo) by Omnibus-Type, SIL Open Font License
1.1. Use the expanded width (`font-stretch: 125%`) at weight 600 for display and the
wordmark, and the normal width at weights 400 and 500 for text. One variable font file
covers both. The wordmark in the logo files is outlined, so it needs no font installed.

## Rebuilding

The logo is generated from code. The tower curves, cut width and bridge are parameters
in `source/mark.py`, and changing them rebuilds every file the same way.

```sh
python3 -m venv .venv && .venv/bin/pip install -r source/requirements.txt
npm pack @fontsource-variable/archivo && tar -xzf fontsource-variable-archivo-*.tgz
.venv/bin/python source/build.py package/files/archivo-latin-wdth-normal.woff2 . /tmp/st-cache
```

This writes the SVGs, the icon SVGs, `index.html` and a render list at
`/tmp/st-cache/png-jobs.json`. The PNGs and `favicon.ico` are rendered from the SVGs with
headless Chromium and ImageMagick.
