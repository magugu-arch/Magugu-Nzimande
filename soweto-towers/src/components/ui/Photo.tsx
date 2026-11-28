import Image from 'next/image';
import { image, type ImageSlug } from '@/content/images';

type Props = {
  slug: ImageSlug;
  /** Responsive sizes hint, e.g. "(min-width: 1040px) 33vw, 100vw". */
  sizes: string;
  className?: string;
  /** Above-the-fold hero: load eagerly at high priority (Next 16: preload replaces priority). */
  eager?: boolean;
  alt?: string;
  quality?: 60 | 75 | 85;
  focus?: string;
};

/** A cover-cropped photo that fills its positioned parent (use inside `.frame`). */
export function Photo({ slug, sizes, className, eager, alt, quality = 75, focus }: Props) {
  const img = image(slug);
  return (
    <Image
      src={img.src}
      alt={alt ?? img.alt}
      fill
      sizes={sizes}
      quality={quality}
      placeholder="blur"
      blurDataURL={img.blurDataURL}
      className={className}
      style={{ objectFit: 'cover', objectPosition: focus ?? img.focus }}
      {...(eager ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {})}
    />
  );
}
