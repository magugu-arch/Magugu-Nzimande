import burgundy1280 from '../../public/images/IMG_1411-1280.webp?inline';
import burgundy640 from '../../public/images/IMG_1411-640.webp?inline';
import green1280 from '../../public/images/green-gown-1280.webp?inline';
import green640 from '../../public/images/green-gown-640.webp?inline';
import gown1280 from '../../public/images/burgundy-gown-1280.webp?inline';
import gown640 from '../../public/images/burgundy-gown-640.webp?inline';
import shirt1280 from '../../public/images/white-shirt-look-1280.webp?inline';
import shirt640 from '../../public/images/white-shirt-look-640.webp?inline';

/**
 * SINGLE-FILE BUILD ONLY: the photographs as data URIs. WebP only (every
 * current browser reads it), so the file stays a few megabytes.
 */
const table: Record<string, { w640: string; w1280: string }> = {
  'burgundy-gown': { w640: gown640, w1280: gown1280 },
  'white-shirt-look': { w640: shirt640, w1280: shirt1280 },
  'green-gown': { w640: green640, w1280: green1280 },
  IMG_1411: { w640: burgundy640, w1280: burgundy1280 },
};

export function imageUrls(src: string) {
  const key = src.split('/').pop() ?? '';
  const t = table[key] ?? table['burgundy-gown']!;
  return { w640: t.w640, w1280: t.w1280, fallback: t.w1280 };
}
