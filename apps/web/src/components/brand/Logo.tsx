import Image from 'next/image';

/**
 * The primary logo, per Brand Identity Guidelines v1.0 section 03: symbol mark,
 * wordmark and descriptor in one horizontal lock-up.
 *
 * It is a single image of the licensed master artwork, which is what stops the
 * elements being rearranged, restacked or restyled by a later CSS change. The
 * `reversed` variant is the guidelines' own dark-ground lock-up — white symbol
 * and descriptor, bb.q Red wordmark — derived by infra/scripts, never recoloured
 * in the browser.
 *
 * Preferred grounds are white and bb.q Black. On anything else, check contrast
 * before using it.
 */

const RATIO = 1552 / 278;

export function Logo({
  reversed = false,
  height = 34,
  priority = false,
  className,
}: {
  reversed?: boolean;
  height?: number;
  priority?: boolean;
  className?: string;
}) {
  const name = reversed ? 'lockup-reversed' : 'lockup';
  const width = Math.round(height * RATIO);

  return (
    <Image
      // Clear space is held by the layout around this element rather than baked
      // into the file, so the master stays tight-cropped to its ink.
      src={`/brand/${name}-720.png`}
      alt="bb.q Chicken"
      width={width}
      height={height}
      priority={priority}
      className={className}
      sizes={`${width}px`}
    />
  );
}
