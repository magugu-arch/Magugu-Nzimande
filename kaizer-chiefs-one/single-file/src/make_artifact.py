"""Turn the standalone single-file app into a claude.ai Artifact page.

Usage (from kaizer-chiefs-one/):
    python3 -I single-file/src/make_artifact.py single-file/Kaizer_Chiefs_One_Concept.html <out.html>

The Artifact viewer wraps every page in its own doctype/head/body skeleton,
so this drops ours and keeps the title, styles and scripts at the top of the
content (the title must sit in the first 8 KB). It also adapts two things to
the viewer's page contract:

  * The skeleton already pads the page by the phone's top and bottom safe
    areas, so the concept strip must not add the top inset a second time.
  * The side gutters use max(20px, env(safe-area-inset-*)), which is what
    the claude:viewport-fit-sides tag promises.

Publish the result together with the standalone file as a supporting file
named Kaizer_Chiefs_One_Concept.html and the `downloads` capability: the
page's "Save this file" button fetches that file and hands it to the viewer,
which asks the person before saving.
"""
import pathlib
import re
import sys

TITLE = "Kaizer Chiefs One Concept"

src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
s = src.read_text("utf8")

s = re.sub(r"^\s*<!doctype html>\s*", "", s, flags=re.I)
s = re.sub(r"<html[^>]*>\s*<head>\s*", "", s, count=1)
s = re.sub(r'<meta charset="utf-8">\s*', "", s, count=1)
s = re.sub(r'<meta name="viewport"[^>]*>\s*', "", s, count=1)
s, n = re.subn(r"</head>\s*<body>", "", s, count=1)
assert n == 1, "unexpected head/body boundary"
s = re.sub(r"</body>\s*</html>\s*$", "", s)

s, n = re.subn(
    r"<title>[^<]*</title>",
    f'<title>{TITLE}</title>\n<meta name="claude:viewport-fit-sides" content="cover">',
    s,
    count=1,
)
assert n == 1, "title not found"

flag = '<script>document.documentElement.classList.add("js")</script>'
assert flag in s
s = s.replace(
    flag,
    '<script>document.documentElement.classList.add("js");document.documentElement.lang="en-ZA"</script>',
    1,
)

# Link-preview and search tags describe a hosted file; they mean nothing here.
s = re.sub(r'<meta (?:property="og:|name="twitter:)[^>]*>\s*', "", s)
s = re.sub(r'<link rel="(?:icon|apple-touch-icon|canonical)"[^>]*>\s*', "", s)

override = (
    "<style>\n"
    "/* claude.ai viewer: the page skeleton already pads the top and bottom safe areas. */\n"
    ":root{--safe-top:0px}\n"
    ".app{min-height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))}\n"
    "</style>\n"
)
anchor = '<div class="app" id="app">'
assert s.count(anchor) == 1
s = s.replace(anchor, override + anchor, 1)

assert s.lstrip().startswith("<title>"), "title must open the page"
for needle in ("max(20px, env(safe-area-inset-left, 0px))", "max(20px, env(safe-area-inset-right, 0px))"):
    assert needle in s, f"side gutter missing: {needle}"
for forbidden in ("<!doctype", "<html", "<head>", "</head>", "<body", "</body>"):
    assert forbidden not in s.lower(), f"wrapper tag left in: {forbidden}"

dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(s, "utf8")
print(f"wrote {dst} ({dst.stat().st_size / 1048576:.2f} MB)")
