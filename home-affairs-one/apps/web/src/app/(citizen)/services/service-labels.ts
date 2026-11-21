import type { ServiceChannel, ServiceDefinition, ServiceDomain } from '@hao/api-contracts';
import { getAsset } from '@/lib/assets';

/**
 * Words and anchors shared by the service catalogue, the service pages, search
 * and the guidance library. Nothing here is service content: that all comes
 * from the versioned sample catalogue.
 */

/** Anchor on `/services/` for each domain, e.g. `/services/#birth-family`. */
export const DOMAIN_ANCHOR: Record<ServiceDomain, string> = {
  IDENTITY: 'identity',
  PASSPORTS: 'passports',
  BIRTH_FAMILY: 'birth-family',
  MARRIAGE: 'marriage',
  DEATH: 'death',
  CITIZENSHIP: 'citizenship',
  IMMIGRATION: 'immigration',
  TRAVEL: 'travel',
  SUPPORT: 'support',
};

export type Availability = ServiceDefinition['availability'];
export type Release = ServiceDefinition['release'];

/** What a person can do with a service here, as a tag. Tone is always paired with the words. */
export const AVAILABILITY_TAG: Record<
  Availability,
  { label: string; tone: 'success' | 'info' | 'neutral' }
> = {
  APPLY_ONLINE: { label: 'Apply online', tone: 'success' },
  GUIDANCE_AND_HANDOFF: { label: 'Guidance and hand-off', tone: 'info' },
  INFORMATION_ONLY: { label: 'Information', tone: 'neutral' },
};

/** Later phases are labelled; the first release needs no label. */
export function releaseLabel(release: Release): string | null {
  if (release === 'PHASE_2') return 'Planned: phase 2';
  if (release === 'PHASE_3') return 'Planned: phase 3';
  return null;
}

export const CHANNEL_LABEL: Record<ServiceChannel, string> = {
  ONLINE: 'Online in this service',
  SERVICE_OFFICE: 'At a service office',
  PARTNER_BANK: 'At a partner bank point',
  MOBILE_UNIT: 'At a mobile unit',
  MISSION_ABROAD: 'At a mission abroad',
};

export function isInPersonChannel(channel: ServiceChannel): boolean {
  return channel !== 'ONLINE';
}

/**
 * Photographs flagged "needs review" in the asset manifest must stay cropped to
 * their subject. A square crop on the manifest's focal point keeps the detail
 * at the edge of the frame out of view, so that is what they get everywhere a
 * photograph is chosen by the catalogue rather than by the screen.
 */
export function needsTightCrop(assetId: string): boolean {
  return getAsset(assetId).review === 'check';
}
