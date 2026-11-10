import type { ImageSourcePropType } from 'react-native';

/**
 * Every bitmap the app shows, in one place.
 *
 * All current entries are CONCEPT images generated on the Higgsfield
 * reference canvas. They guide layout and mood only: they are not approved
 * club photography, they show generated approximations of club marks, and
 * they must be replaced with licensed, consented photography before release.
 * `ConceptImage` labels every one of them on screen.
 */
export type ImageStatus = 'concept' | 'approved';

export interface ImageEntry {
  source: ImageSourcePropType;
  status: ImageStatus;
  /** Accessible description of the picture itself. */
  alt: string;
  /** Asset id on the reference canvas, for traceability. */
  canvasNode: string | null;
}

export const imagery = {
  stadium: {
    source: require('../../assets/concept/stadium.jpg'),
    status: 'concept',
    alt: 'A full stadium at night under floodlights, supporters waving black and gold flags.',
    canvasNode: '4cbbbe6f-9881-4f5d-831b-645c21d3be25',
  },
  fanCam: {
    source: require('../../assets/concept/fan-cam.jpg'),
    status: 'concept',
    alt: 'A smiling supporter in a gold beanie on the stadium big screen, the crowd cheering below.',
    canvasNode: 'a5f1f82a-0246-4c62-9c25-569a580dd365',
  },
  matchAction: {
    source: require('../../assets/concept/match-action.jpg'),
    status: 'concept',
    alt: 'A player in gold and black running with the ball, a defender in black chasing.',
    canvasNode: '724e48f9-2990-4a2d-9b4b-4b18c40ab3c8',
  },
  merchandise: {
    source: require('../../assets/concept/merchandise.jpg'),
    status: 'concept',
    alt: 'Black and gold merchandise: a scarf, cap, folded jersey, mug, lanyard, key ring and wristband.',
    canvasNode: '7e0acbc7-9b7b-4969-bc4c-c15ecd32d5c3',
  },
  supporterPortrait: {
    source: require('../../assets/concept/supporter-portrait.jpg'),
    status: 'concept',
    alt: 'A supporter in the stands holding a black and gold scarf above her head, laughing.',
    canvasNode: '197bf2a8-9912-41ef-948f-6bd16a8aa4f8',
  },
  squadTunnel: {
    source: require('../../assets/concept/squad-tunnel.jpg'),
    status: 'concept',
    alt: 'Six players in black and gold kit standing together in a lit stadium tunnel.',
    canvasNode: 'ac619a81-7e3b-4b82-9187-172c76d5a729',
  },
  womensTeam: {
    source: require('../../assets/concept/womens-team.jpg'),
    status: 'concept',
    alt: 'Players in gold and black kit joining hands in a huddle before a match.',
    canvasNode: '5c81827d-105d-4587-bce1-3ce8998db4e3',
  },
  youthAcademy: {
    source: require('../../assets/concept/youth-academy.jpg'),
    status: 'concept',
    alt: 'Two coaches crouching to talk with a group of young players on a dry pitch at sunset.',
    canvasNode: '262dc763-6444-4a27-8bc5-40e6ad5d28be',
  },
  community: {
    source: require('../../assets/concept/community.jpg'),
    status: 'concept',
    alt: 'A smiling coach handing a black and gold football to a child, other children watching.',
    canvasNode: '55aea822-ccb9-4fd4-a320-a84eae9664f8',
  },
} satisfies Record<string, ImageEntry>;

export type ImageKey = keyof typeof imagery;

export function isImageKey(key: string | null | undefined): key is ImageKey {
  return !!key && key in imagery;
}
