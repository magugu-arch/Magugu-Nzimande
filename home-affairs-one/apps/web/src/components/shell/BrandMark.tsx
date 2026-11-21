/**
 * The product mark: an arch — "one front door" — on a navy tile, with a gold
 * threshold. It is an abstract shape, deliberately unlike any official emblem.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#102a43" />
      <path d="M10.5 24.5V15a5.5 5.5 0 0 1 11 0v9.5z" fill="#fff" />
      <rect x="7.5" y="23.75" width="17" height="2.25" rx="1.125" fill="#d5a52a" />
    </svg>
  );
}
