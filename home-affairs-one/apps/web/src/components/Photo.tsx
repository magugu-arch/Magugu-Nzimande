'use client';

import { cx } from '@hao/design-system';
import type { CSSProperties } from 'react';
import { assetSrcSet, assetUrl, getAsset } from '@/lib/assets';
import { usePrefs } from '@/lib/prefs';
import styles from './Photo.module.css';

export interface PhotoProps {
  /** Asset ID from `assets/manifest.json`, e.g. `"A12"`. */
  asset: string;
  /**
   * Crop ratio as CSS `aspect-ratio` (`'4 / 5'`, `'16 / 9'`, `'1 / 1'`). Omit to
   * fill the parent's height; use `'native'` for the photograph's own ratio.
   */
  ratio?: string;
  /** How wide the image is drawn, for the browser to pick a file. */
  sizes?: string;
  /** `arch` is the "one front door" mask for portrait feature images. */
  shape?: 'rounded' | 'soft' | 'arch' | 'square' | 'circle';
  /** Above-the-fold images load eagerly; everything else is lazy. */
  priority?: boolean;
  /**
   * Set when nearby text already says what the image shows, so screen readers
   * skip it. Otherwise the manifest's alt text is used.
   */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * The only way photographs appear in the app. Alt text, focal point and
 * responsive sizes come from the asset manifest, so a crop on a small screen
 * keeps the subject in frame. With "Use less data" on, only the smallest file
 * is ever requested.
 */
export function Photo({
  asset: assetId,
  ratio,
  sizes = '(min-width: 60rem) 40vw, 100vw',
  shape = 'rounded',
  priority = false,
  decorative = false,
  className,
  style,
}: PhotoProps) {
  const asset = getAsset(assetId);
  const { prefs } = usePrefs();
  const smallest = asset.widths[0] ?? asset.width;
  const largest = asset.widths[asset.widths.length - 1] ?? asset.width;
  const aspectRatio = ratio === 'native' ? `${asset.width} / ${asset.height}` : ratio;

  return (
    <span
      className={cx(styles.frame, shape !== 'rounded' && styles[shape], className)}
      style={
        {
          '--photo-color': asset.color,
          aspectRatio,
          height: aspectRatio ? undefined : '100%',
          ...style,
        } as CSSProperties
      }
    >
      <img
        src={assetUrl(asset.id, prefs.dataSaver ? smallest : largest)}
        srcSet={prefs.dataSaver ? undefined : assetSrcSet(asset)}
        sizes={prefs.dataSaver ? undefined : sizes}
        width={asset.width}
        height={asset.height}
        alt={decorative ? '' : asset.alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        style={{ objectPosition: `${asset.focal[0]}% ${asset.focal[1]}%` }}
      />
    </span>
  );
}
