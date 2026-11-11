#!/usr/bin/env python3
"""Crop the deck's photographs from the original concept images.

    python3 -I deck/prepare_images.py <folder with the original PNGs>

Every source is a CONCEPT image supplied for this pitch (generated on the
reference canvas). They are not club photography. Crops are chosen so that no
standalone crest rendering appears; marks that remain are incidental (on a
shirt or a flag in the scene). The deck labels the imagery as concept on every
page that uses it. Nothing is redrawn, recoloured or retouched: this script
only crops, resizes and re-encodes.
"""
import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).parent / "images"

# name: (source id, x0, y0, x1, y1 as fractions of the source, output width)
CROPS = {
    # Full-bleed photo slides, 1500 x 755 on the page.
    "cover": ("58dbd15b", 0.00, 0.310, 1.00, 0.713, 1792),
    "part-one": ("2870e134", 0.00, 0.050, 1.00, 0.945, 2400),
    "part-two": ("c99ac1fe", 0.245, 0.545, 0.756, 1.000, 1374),
    "closing": ("c3d589b4", 0.00, 0.040, 1.00, 0.935, 2400),
    # Strips, 1500 x 168.
    "strip-crowd": ("c99ac1fe", 0.00, 0.790, 1.00, 0.988, 2400),
    "strip-hands": ("2870e134", 0.00, 0.720, 1.00, 0.919, 2400),
    "strip-pitch": ("e5e0828a", 0.00, 0.760, 1.00, 0.958, 2400),
    "strip-ball": ("ccbbed4d", 0.00, 0.652, 1.00, 0.742, 2400),
    # Supporter cards, 222 x 344.
    "p-regular": ("c99ac1fe", 0.42, 0.600, 0.566, 1.000, 392),
    "p-faraway": ("e5e0828a", 0.335, 0.410, 0.55, 1.000, 520),
    "p-family": ("ccbbed4d", 0.45, 0.280, 1.00, 0.962, 520),
    "p-member": ("c3d589b4", 0.50, 0.100, 0.75, 0.790, 520),
    "p-newgen": ("c3d589b4", 0.00, 0.256, 0.27, 1.000, 520),
    "p-lapsed": ("ba1b9d02", 0.40, 0.280, 0.62, 0.880, 520),
    # Campaign cards, 277 x 313.
    "c-matchday": ("ba1b9d02", 0.40, 0.200, 0.75, 0.900, 640),
    "c-membership": ("58dbd15b", 0.27, 0.300, 0.73, 0.715, 640),
    "c-kit": ("7db14c86", 0.20, 0.360, 0.80, 0.900, 640),
    "c-moment": ("c99ac1fe", 0.36, 0.070, 0.62, 0.590, 640),
    "c-bring": ("2870e134", 0.52, 0.240, 0.90, 1.000, 640),
}


def main() -> None:
    src = Path(sys.argv[1])
    OUT.mkdir(exist_ok=True)
    cache: dict[str, Image.Image] = {}
    for name, (sid, x0, y0, x1, y1, width) in CROPS.items():
        if sid not in cache:
            cache[sid] = Image.open(next(src.glob(f"{sid}-*"))).convert("RGB")
        im = cache[sid]
        box = (round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height))
        crop = im.crop(box)
        width = min(width, crop.width)
        crop = crop.resize((width, round(crop.height * width / crop.width)), Image.LANCZOS)
        # A fresh save drops every metadata block the source carried.
        crop.save(OUT / f"{name}.jpg", quality=82, optimize=True)
        print(f"{name:14s} {crop.width}x{crop.height}  {(OUT / f'{name}.jpg').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
