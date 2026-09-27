import burgundy1280 from '../../public/images/IMG_1411-1280.webp?inline';
import burgundy640 from '../../public/images/IMG_1411-640.webp?inline';
import styled1280 from '../../public/images/IMG_2243-1280.webp?inline';
import styled640 from '../../public/images/IMG_2243-640.webp?inline';
import white1280 from '../../public/images/IMG_2438-1280.webp?inline';
import white640 from '../../public/images/IMG_2438-640.webp?inline';

/**
 * SINGLE-FILE BUILD ONLY: the photographs as data URIs. WebP only (every
 * current browser reads it), so the file stays a few megabytes.
 */
const table: Record<string, { w640: string; w1280: string }> = {
  IMG_2438: { w640: white640, w1280: white1280 },
  IMG_2243: { w640: styled640, w1280: styled1280 },
  IMG_1411: { w640: burgundy640, w1280: burgundy1280 },
};

export function imageUrls(src: string) {
  const key = src.split('/').pop() ?? '';
  const t = table[key] ?? table.IMG_2438!;
  return { w640: t.w640, w1280: t.w1280, fallback: t.w1280 };
}
