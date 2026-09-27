import { images, type ImageKey } from '../../data/images';

/**
 * A supplied Grateful photograph at the right size for the screen: WebP at
 * 640 and 1280 wide, the original JPEG as the fallback. Below-the-fold images
 * load lazily; pass `priority` for the one image that is the first thing seen.
 */
export function Picture({
  image,
  sizes = '100vw',
  priority = false,
  mono = false,
  className = '',
  imgClassName = '',
  focus,
  alt,
}: {
  image: ImageKey | string;
  sizes?: string;
  priority?: boolean;
  mono?: boolean;
  className?: string;
  imgClassName?: string;
  /** Override the stored object-position for this crop. */
  focus?: string;
  /** Override alt, e.g. '' when the image is decorative next to its own caption. */
  alt?: string;
}) {
  const img = images[image as ImageKey] ?? images.whiteGarment;
  return (
    <picture className={`block overflow-hidden ${className}`}>
      <source type="image/webp" srcSet={`${img.src}-640.webp 640w, ${img.src}-1280.webp 1280w`} sizes={sizes} />
      <img
        src={`${img.src}.jpeg`}
        alt={alt ?? img.alt}
        width={img.width}
        height={img.height}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        style={{ objectPosition: focus ?? img.focus }}
        className={`h-full w-full object-cover ${mono ? 'mono' : ''} ${imgClassName}`}
      />
    </picture>
  );
}
