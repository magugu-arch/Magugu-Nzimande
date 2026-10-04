import { photoFiles, type PhotoFileKey } from './photoFiles.generated';

/**
 * The NMU ONE image library — brief §18.
 *
 * Screens ask for a *library slot* ("cafeteria", "alumniMentorship"), never a
 * file. Each slot names the master that fills it, the alt text, and the focal
 * point used when a placement crops the 16:9 frame. The design team can
 * replace a photograph by swapping a master and re-running
 * `npm run assets:photos`, without touching a component (brief §18 "keep
 * images separate from UI logic").
 *
 * The brief lists 18 slots. 17 photographs were supplied; "Alumni Mentorship"
 * has no photograph of its own yet, so it borrows the lecturer image (a
 * mentor-and-students moment) and is flagged `standIn` until one arrives.
 */

/** expo-image `contentPosition` — where the subject sits in the frame. */
export interface FocalPoint {
  left: `${number}%`;
  top: `${number}%`;
}

export interface PhotoSlot {
  file: PhotoFileKey;
  alt: string;
  focus: FocalPoint;
  /** True while the slot borrows another slot's photograph. */
  standIn?: boolean;
}

const slot = (
  file: PhotoFileKey,
  alt: string,
  left: number,
  top: number,
  standIn?: boolean,
): PhotoSlot => ({
  file,
  alt,
  focus: { left: `${left}%`, top: `${top}%` },
  ...(standIn ? { standIn } : {}),
});

export const photoLibrary = {
  heroCampus: slot(
    'hero-campus',
    'Three students walking and talking on a sunlit campus walkway, with the bay and city behind them.',
    28,
    45,
  ),
  studentJourney: slot(
    'student-journey',
    'A student checks her phone as she walks across campus, friends chatting behind her.',
    70,
    35,
  ),
  academicSuccess: slot(
    'academic-success',
    'A student takes notes beside his laptop in a bright study hall overlooking the sea.',
    52,
    40,
  ),
  library: slot(
    'library',
    'Students working at long tables in a light-filled library with floor-to-ceiling windows.',
    30,
    55,
  ),
  cafeteria: slot(
    'cafeteria',
    'A student pays with her phone as a server hands over a fresh bowl at the campus food hall.',
    45,
    45,
  ),
  residence: slot(
    'residence',
    'A student with a suitcase checks in at the residence front desk.',
    60,
    40,
  ),
  shuttle: slot(
    'shuttle',
    'Students wait at a covered stop as the campus shuttle pulls in.',
    40,
    45,
  ),
  safety: slot(
    'safety',
    'Friends walk together along a well-lit campus path at dusk, with a campus protection officer nearby.',
    55,
    45,
  ),
  events: slot(
    'events',
    'Students relax on the lawn at an open-air campus festival with a band on stage.',
    50,
    60,
  ),
  parentConnection: slot(
    'parent-connection',
    'A mother and daughter smile at a laptop together at home.',
    35,
    40,
  ),
  staffLecturer: slot(
    'staff-lecturer',
    'A lecturer leans in to talk with students working at their desks.',
    55,
    40,
  ),
  graduation: slot(
    'graduation',
    'A graduate in cap and gown is hugged by her proud parents outside the hall.',
    45,
    35,
  ),
  alumniMentorship: slot(
    'staff-lecturer',
    'An experienced mentor talks through ideas with a group of students.',
    55,
    40,
    true,
  ),
  alumniGiving: slot(
    'alumni-giving',
    'An alumnus hands a smiling student her bursary award at an alumni giving event.',
    55,
    45,
  ),
  campusInnovation: slot(
    'campus-innovation',
    'Student entrepreneurs talk with a customer at their stall in the campus marketplace.',
    50,
    50,
  ),
  digitalLearning: slot(
    'digital-learning',
    'Four students with laptops, tablets and headphones learning together.',
    50,
    60,
  ),
  wellbeing: slot(
    'wellbeing',
    'A wellbeing counsellor chats with a small group of students in a calm lounge.',
    50,
    55,
  ),
  nmuCommunity: slot(
    'nmu-community',
    'A diverse group of students laughing together on the steps above the bay.',
    60,
    55,
  ),
} as const satisfies Record<string, PhotoSlot>;

export type PhotoKey = keyof typeof photoLibrary;
export type PhotoSize = 'sm' | 'md' | 'lg';

export function photoSource(key: PhotoKey, size: PhotoSize): number {
  return photoFiles[photoLibrary[key].file][size];
}

/** Slots still waiting on a supplied photograph. */
export const standInSlots = (Object.keys(photoLibrary) as PhotoKey[]).filter(
  (k) => (photoLibrary[k] as PhotoSlot).standIn,
);

export const isPhotoKey = (value: string): value is PhotoKey => value in photoLibrary;

/** Content from an adapter names its photo as a string; unknown names fall back. */
export const asPhotoKey = (value: string, fallback: PhotoKey = 'nmuCommunity'): PhotoKey =>
  isPhotoKey(value) ? value : fallback;
