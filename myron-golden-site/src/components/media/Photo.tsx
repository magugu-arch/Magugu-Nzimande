import Image from 'next/image';
import { assetSrc, getAsset } from '@/content/assets';
import { cn } from '@/lib/cn';

interface PhotoProps {
  /** Asset register id, e.g. "MG-04". */
  id: string;
  sizes: string;
  /** Fill the positioned parent and crop to it, honouring the asset's focus point. */
  fill?: boolean;
  className?: string;
  /** Override the register's alt — e.g. "" when an adjacent caption already describes it. */
  alt?: string;
  /**
   * Above the fold — usually the page's largest paint. Loads eagerly at high
   * fetch priority (Next 16 recommends this over `preload` in most cases).
   */
  priority?: boolean;
  quality?: 70 | 82;
  /** Override the focus point used for object-position. */
  focus?: string;
}

/**
 * Every photograph goes through here, so alt text, dimensions and crop focus
 * come from the asset register rather than being retyped on each page.
 * Explicit dimensions (or `fill` in a sized box) mean no layout shift.
 */
export function Photo({
  id,
  sizes,
  fill = false,
  className,
  alt,
  priority = false,
  quality = 70,
  focus,
}: PhotoProps) {
  const asset = getAsset(id);
  const common = {
    src: assetSrc(asset),
    sizes,
    quality,
    ...(priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {}),
  };
  const altText = alt ?? asset.alt;
  if (fill) {
    return (
      <Image
        {...common}
        alt={altText}
        fill
        className={cn('object-cover', className)}
        style={{ objectPosition: focus ?? asset.focus ?? '50% 50%' }}
      />
    );
  }
  return (
    <Image
      {...common}
      alt={altText}
      width={asset.width}
      height={asset.height}
      className={cn('h-auto w-full', className)}
    />
  );
}
