import { mediaById } from '@scarlets/adapters';
import type { MediaAsset } from '@scarlets/domain';
import { mediaSources, type MediaId } from './sources.generated';

export type { MediaId };

export function mediaSource(id: string): number | undefined {
  return (mediaSources as Record<string, number>)[id];
}

export function mediaAsset(id: string): MediaAsset | undefined {
  return mediaById.get(id);
}
