import { mediaById, mediaSeed } from '@scarlets/adapters';

export interface MediaView {
  id: string;
  src: string;
  alt: string;
  label: string;
  width: number;
  height: number;
}

/** A concept image, served from /media (see scripts/sync-media.mjs). */
export function mediaFor(id: string): MediaView | null {
  const asset = mediaById.get(id);
  if (!asset) return null;
  return {
    id: asset.id,
    src: `/media/${asset.file}`,
    alt: asset.alt.en,
    label: asset.label.en,
    width: asset.width,
    height: asset.height,
  };
}

/** Photographs an editor can choose from. The two identity references are not editorial images. */
export function mediaChoices(): Array<{ id: string; label: string }> {
  return mediaSeed
    .filter((asset) => asset.kind === 'photograph')
    .map((asset) => ({ id: asset.id, label: `${asset.number}. ${asset.label.en}` }));
}
