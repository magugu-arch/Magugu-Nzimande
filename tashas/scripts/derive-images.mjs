#!/usr/bin/env node
/**
 * Web derivatives of the 28 originals, for embedding in the single-file app.
 *
 * Originals are never modified. Each derivative is a WebP sized for the
 * largest place the app shows it (portrait images to 1120px tall, wide ones
 * to 1400px across), written to build/derived/ with a JSON index. Requires
 * Python 3 with Pillow, the same tooling the repository's other image
 * scripts use. Run: npm run assets:derive
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'build', 'derived');
mkdirSync(out, { recursive: true });

const PY = String.raw`
import json, os, sys
from PIL import Image, ImageOps

root, out = sys.argv[1], sys.argv[2]
manifest = json.load(open(os.path.join(root, 'assets', 'Tashas_28_Image_Asset_Metadata.json')))
index = {}
for a in manifest['assets']:
    src = os.path.join(root, 'assets', 'originals', a['filename'])
    dst = os.path.join(out, a['asset_id'] + '.webp')
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    w, h = im.size
    if w > h:
        scale = min(1.0, 1400 / w)
    else:
        scale = min(1.0, 1120 / h)
    size = (round(w * scale), round(h * scale))
    if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
        im.resize(size, Image.LANCZOS).save(dst, 'WEBP', quality=78, method=6)
    index[a['asset_id']] = {'file': os.path.basename(dst), 'w': size[0], 'h': size[1], 'bytes': os.path.getsize(dst)}
json.dump(index, open(os.path.join(out, 'index.json'), 'w'), indent=2)
total = sum(v['bytes'] for v in index.values())
print('Derived %d images, %.2f MB of WebP' % (len(index), total / 1048576))
`;

try {
  execFileSync('python3', ['-c', PY, root, out], { stdio: 'inherit' });
} catch {
  console.error('Image derivation needs Python 3 with Pillow (pip install pillow).');
  process.exit(1);
}
