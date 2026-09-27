import { images, type ImageKey } from '../../data/images';
import { imageUrls } from '../../data/imageUrls';

/**
 * A supplied Grateful photograph at the right size for the screen: WebP at
 * 640 and 1280 wide, the original JPEG as the fallback. Below-the-fold images
 * load lazily; pass `priority` for the one image that is the first thing seen.
 */
export function Picture({
  image,
  sizes = '100vw',
  priority = false,
  className = '',
  imgClassName = '',
  focus,
  alt,
}: {
  image: ImageKey | string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  /** Override the stored object-position for this crop. */
  focus?: string;
  /** Override alt, e.g. '' when the image is decorative next to its own caption. */
  alt?: string;
}) {
  const img = images[image as ImageKey] ?? images.burgundyGown;
  const url = imageUrls(img.src);
  return (
    <picture className={`block overflow-hidden ${className}`}>
      <source type="image/webp" srcSet={`${url.w640} 640w, ${url.w1280} ${Math.min(1280, img.width)}w`} sizes={sizes} />
      <img
        src={url.fallback}
        alt={alt ?? img.alt}
        width={img.width}
        height={img.height}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        style={{ objectPosition: focus ?? img.focus }}
        className={`h-full w-full object-cover ${imgClassName}`}
      />
    </picture>
  );
}
