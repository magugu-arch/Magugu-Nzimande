"""Turn the standalone single-file app into a claude.ai Artifact page.

The Artifact viewer wraps every page in its own doctype/head/body skeleton,
so this drops ours and keeps the title, metadata, styles and scripts at the
top of the content (the title must sit in the first 8 KB).

Usage: python3 -I make_artifact.py <standalone.html> <artifact/index.html>
"""
import pathlib
import re
import sys

src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
s = src.read_text("utf8")
s = re.sub(r"^\s*<!doctype html>\s*", "", s, flags=re.I)
s = re.sub(r"<html[^>]*>\s*<head>\s*", "", s, count=1)
s = re.sub(r'<meta charset="utf-8">\s*', "", s, count=1)
s = re.sub(r'<meta name="viewport"[^>]*>\s*', "", s, count=1)
s, n = re.subn(r"</head>\s*<body>", "", s, count=1)
assert n == 1, "unexpected head/body boundary"
s = re.sub(r"</body>\s*</html>\s*$", "", s)
flag = '<script>document.documentElement.classList.add("js")</script>'
assert flag in s
s = s.replace(flag, '<script>document.documentElement.classList.add("js");document.documentElement.lang="en-ZA"</script>', 1)
assert s.lstrip().startswith("<title>"), "title must open the page"
dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(s, "utf8")
print(f"wrote {dst} ({dst.stat().st_size / 1048576:.2f} MB)")
