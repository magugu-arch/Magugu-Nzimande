/**
 * Where each photograph's files live. The single-file build swaps this module
 * for imageUrls.inline.ts (see vite.config.ts), which embeds the images so
 * the page opens from a double-click with no server.
 */
export function imageUrls(src: string) {
  return { w640: `${src}-640.webp`, w1280: `${src}-1280.webp`, fallback: `${src}.jpeg` };
}
