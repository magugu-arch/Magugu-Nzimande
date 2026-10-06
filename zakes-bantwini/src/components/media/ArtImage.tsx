import type { CSSProperties } from 'react';
import { preload } from 'react-dom';
import {
  getMedia,
  getMediaFile,
  mediaSrcSet,
  mediaUrl,
  type Focal,
  type Hover,
  type MediaId,
  type Overlay,
  type Ratio,
} from '@/content/media';
import styles from './ArtImage.module.css';

type Props = {
  id: MediaId;
  /** `sizes` attribute — how wide the image renders. Defaults to full viewport. */
  sizes?: string;
  /**
   * `fill` stretches to the parent (which must be positioned and sized);
   * otherwise the frame keeps the registry ratio, or the one given here.
   */
  fill?: boolean;
  ratio?: { desktop?: Ratio; mobile?: Ratio };
  focal?: Focal;
  mobileFocal?: Focal;
  overlay?: Overlay;
  hover?: Hover;
  /** Preload and fetch at high priority. Use once per page, for the first visible image. */
  priority?: boolean;
  /** Override the CMS alt text for this placement. */
  alt?: string;
  /** The image repeats nearby text and adds nothing for screen readers. */
  decorative?: boolean;
  className?: string;
  /** Applied to the <img>, for parallax or zoom transforms owned by a parent. */
  imgClassName?: string;
};

export function ArtImage({
  id,
  sizes = '100vw',
  fill = false,
  ratio,
  focal,
  mobileFocal,
  overlay,
  hover,
  priority,
  alt,
  decorative = false,
  className,
  imgClassName,
}: Props) {
  const asset = getMedia(id);
  const file = getMediaFile(id);
  const isPriority = priority ?? false;
  const avif = mediaSrcSet(id, 'avif');
  const webp = mediaSrcSet(id, 'webp');
  const fallbackWidth = file.widths.find((w) => w >= 828) ?? file.widths[file.widths.length - 1]!;

  if (isPriority) {
    preload(mediaUrl(id, fallbackWidth, 'avif'), {
      as: 'image',
      imageSrcSet: avif,
      imageSizes: sizes,
      type: 'image/avif',
      fetchPriority: 'high',
    });
  }

  const f = focal ?? asset.focal;
  const mf = mobileFocal ?? asset.mobileFocal ?? f;
  const style = {
    '--ratio-d': ratio?.desktop ?? asset.desktopRatio,
    '--ratio-m': ratio?.mobile ?? asset.mobileRatio,
    '--fx': `${f.x}%`,
    '--fy': `${f.y}%`,
    '--mfx': `${mf.x}%`,
    '--mfy': `${mf.y}%`,
    '--placeholder': `url(${file.blur})`,
    '--tone': file.color,
  } as CSSProperties;

  const overlayKind = overlay ?? asset.overlay ?? 'none';
  const hoverKind = hover ?? asset.hover ?? 'none';

  return (
    <figure
      className={[styles.frame, fill ? styles.fill : styles.ratio, hoverKind === 'zoom' ? styles.zoom : '', className]
        .filter(Boolean)
        .join(' ')}
      style={style}
      data-media={id}
    >
      <picture>
        <source type="image/avif" srcSet={avif} sizes={sizes} />
        <source type="image/webp" srcSet={webp} sizes={sizes} />
        <img
          className={[styles.img, imgClassName].filter(Boolean).join(' ')}
          src={mediaUrl(id, fallbackWidth, 'webp')}
          alt={decorative ? '' : (alt ?? asset.alt)}
          width={file.width}
          height={file.height}
          loading={isPriority ? 'eager' : 'lazy'}
          decoding={isPriority ? 'sync' : 'async'}
          fetchPriority={isPriority ? 'high' : 'auto'}
        />
      </picture>
      {overlayKind !== 'none' && <span className={`${styles.overlay} ${styles[`overlay-${overlayKind}`]}`} aria-hidden="true" />}
    </figure>
  );
}
