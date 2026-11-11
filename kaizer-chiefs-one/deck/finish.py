#!/usr/bin/env python3
"""Stamp the deck's document metadata.

    python3 -I deck/finish.py <in.pdf> <out.pdf> <title> <description> [titles.json]

Keeps the pages and tags exactly as printed. titles.json maps a bookmark title
as Chromium wrote it (words run together at a forced line break) to the title
with its space restored.
"""
import json
import logging
import os
import sys

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject

# Chromium's cross-reference table undercounts its own objects; pypdf reads the
# file correctly and writes an exact table, so the notice is noise.
logging.getLogger("pypdf").setLevel(logging.ERROR)


def retitle(node, titles: dict[str, str]) -> int:
    """Walk the bookmark tree from `node`, restoring spaces. Returns how many changed."""
    changed = 0
    while node is not None:
        item = node.get_object()
        current = item.get("/Title")
        if current in titles:
            item[NameObject("/Title")] = TextStringObject(titles[current])
            changed += 1
        changed += retitle(item.get("/First"), titles)
        node = item.get("/Next")
    return changed


def main() -> None:
    src, dst, title, description = sys.argv[1:5]
    titles_file = sys.argv[5] if len(sys.argv) > 5 else None
    reader = PdfReader(src)
    writer = PdfWriter(clone_from=reader)
    if titles_file:
        with open(titles_file, encoding="utf-8") as fh:
            titles = json.load(fh)
        outlines = writer.root_object.get("/Outlines")
        if outlines is not None:
            fixed = retitle(outlines.get_object().get("/First"), titles)
            print(f"{fixed} bookmark titles had their spaces restored")
        os.remove(titles_file)
    writer.add_metadata(
        {
            "/Title": title,
            "/Author": "LegacyLeverage Creative Agency",
            "/Subject": description,
            "/Keywords": "Kaizer Chiefs One, app, marketing strategy, investment, costing, proposal, concept",
            "/Creator": "Kaizer Chiefs One deck build",
        }
    )
    # Open with the outline panel available and the page fitted to the window.
    writer.page_layout = "/SinglePage"
    # The file uses transparency and tagging, so declare a version that has both.
    writer.pdf_header = "%PDF-1.7"
    with open(dst, "wb") as fh:
        writer.write(fh)
    os.remove(src)
    print(f"{len(reader.pages)} pages, {reader.pages[0].mediabox.width} x {reader.pages[0].mediabox.height} pt")


if __name__ == "__main__":
    main()
