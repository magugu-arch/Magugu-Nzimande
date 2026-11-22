/**
 * The product mark: a doorway — "one front door" — cut square into a gold
 * tile, standing on its threshold. It is an abstract shape, deliberately
 * unlike any official emblem, and it has no rounded corners.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" fill="#d5a52a" />
      <rect x="11" y="7" width="10" height="16" fill="#070c14" />
      <rect x="7" y="23" width="18" height="2" fill="#070c14" />
    </svg>
  );
}
