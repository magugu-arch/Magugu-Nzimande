import { getImageProps } from 'next/image';
import { image, type ImageSlug } from '@/content/images';

/**
 * One <picture> with a landscape crop for wide screens and a portrait crop for
 * phones, so each device downloads only its own file (Next.js art direction).
 */
export function ArtDirectedImage({
  wide,
  tall,
  breakpoint = 900,
  eager,
  className,
  alt,
}: {
  alt?: string;
  wide: ImageSlug;
  tall: ImageSlug;
  breakpoint?: number;
  eager?: boolean;
  className?: string;
}) {
  const w = image(wide);
  const t = image(tall);
  const common = { fill: true, quality: 75 as const };
  const {
    props: { srcSet: wideSet, sizes: wideSizes },
  } = getImageProps({ ...common, src: w.src, alt: w.alt, sizes: '(min-width: 1320px) 1280px, 100vw' });
  const { props: tallProps } = getImageProps({ ...common, src: t.src, alt: t.alt, sizes: '100vw' });
  return (
    <picture className={className}>
      <source media={`(min-width: ${breakpoint}px)`} srcSet={wideSet} sizes={wideSizes} />
      <img
        {...tallProps}
        alt={alt ?? w.alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
        style={{ ...tallProps.style, objectFit: 'cover', objectPosition: 'var(--focus, 50% 50%)' }}
      />
    </picture>
  );
}
