/**
 * Stand-in for `@/lib/assets` in the single-file build: every photograph is
 * embedded in the file, so there is one copy per asset and no `srcset`.
 */
import generated from '@/generated/asset-manifest.json';
import { EMBEDDED } from '../generated/images';

export interface AssetRecord {
  id: string;
  source: string;
  subject: string;
  alt: string;
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

export function assetUrl(id: string, _width: number): string {
  return EMBEDDED[id] ?? '';
}

export function assetSrcSet(_asset: AssetRecord): string {
  return '';
}
