import { assetSrc, getAsset } from '@/content/assets';
import type { GalleryItem } from './Gallery';

/** Gallery entries straight from the asset register. */
export function galleryItems(ids: string[]): GalleryItem[] {
  return ids.map((id) => {
    const a = getAsset(id);
    return { src: assetSrc(a), width: a.width, height: a.height, alt: a.alt, focus: a.focus };
  });
}
