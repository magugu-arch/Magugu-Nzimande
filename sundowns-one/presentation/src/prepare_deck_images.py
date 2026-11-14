"""Prepare the deck's photographs as JPEGs from the 51 supplied uploads.

Usage: python3 -I prepare_deck_images.py <upload_dir>

Uses the same IMG-to-upload mapping and crops as the app (../../src), at full
upload resolution, and writes img/<id>.jpg. Only images the app places on a
screen are used; nothing on hold or rugby-branded goes into the deck.
"""
import json
import pathlib
import sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
APP = HERE.parent.parent / "src"
sys.path.insert(0, str(APP))
from prepare_images import SOURCES  # noqa: E402

USE = ["7676", "7677", "7678", "7680", "7681", "7682", "7683", "7685", "7687", "7689", "7691", "7692",
       "7693", "7694", "7695", "7696", "7697", "7699", "7700", "7704", "7705", "7707"]


def main():
    up = pathlib.Path(sys.argv[1])
    assets = {a["id"]: a for a in json.loads((APP / "assets.json").read_text("utf8"))["assets"]}
    (HERE / "img").mkdir(exist_ok=True)
    total = 0
    for i in USE:
        a = assets[i]
        assert a["status"] in ("use", "cropped", "review"), i
        im = Image.open(up / SOURCES[i]).convert("RGB")
        if a.get("crop"):
            im = im.crop(tuple(a["crop"]))
        out = HERE / "img" / f"{i}.jpg"
        im.save(out, "JPEG", quality=86, optimize=True, progressive=True)
        total += out.stat().st_size
    crest = Image.open(APP / "brand" / "crest.webp")
    crest.save(HERE / "img" / "crest.png", optimize=True)
    print(f"{len(USE)} photos, {total / 1048576:.1f} MB")


if __name__ == "__main__":
    main()
