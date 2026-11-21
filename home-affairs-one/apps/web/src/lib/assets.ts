import generated from '@/generated/asset-manifest.json';
import { withBasePath } from './base-path';

export interface AssetRecord {
  id: string;
  source: string;
  subject: string;
  alt: string;
  /** Focal point as percentages from the left and top, used for safe crops. */
  focal: [number, number];
  placements: string[];
  review: 'ok' | 'check';
  reviewNote?: string;
  width: number;
  height: number;
  color: string;
  widths: number[];
}

const records = generated.assets as unknown as AssetRecord[];
const byId = new Map(records.map((asset) => [asset.id, asset]));

export const ALL_ASSETS: readonly AssetRecord[] = records;

export function getAsset(id: string): AssetRecord {
  const asset = byId.get(id);
  if (!asset) throw new Error(`Unknown photograph "${id}". See assets/manifest.json.`);
  return asset;
}

export function assetUrl(id: string, width: number): string {
  return withBasePath(`/assets/home-affairs-one/${id}-${width}.webp`);
}

export function assetSrcSet(asset: AssetRecord): string {
  return asset.widths.map((width) => `${assetUrl(asset.id, width)} ${width}w`).join(', ');
}
