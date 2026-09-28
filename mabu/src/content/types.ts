/** CMS documents for venue details and the home screen (brief §3, §5, §28 CMS). */

export interface OpeningHours {
  /** 0 = Sunday … 6 = Saturday. */
  day: number;
  label: string;
  /** "12:00–22:00", or null when closed. */
  hours: string | null;
}

export interface VenueContent {
  id: 'venue';
  name: string;
  area: string;
  addressLines: string[];
  email: string;
  /** null until Mábu confirms the number to publish — the app then hides Call. */
  phone: string | null;
  mapsQuery: string;
  latitude?: number;
  longitude?: number;
  hours: OpeningHours[];
  arrivalNotes: string[];
  instagram?: string;
  dineplanUrl?: string;
  isSample: boolean;
  updatedAt: string;
}

export interface EditorialStory {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  photo: string;
}

export interface HomeContent {
  id: 'home';
  heroPhoto: string;
  heroTitle: string;
  heroSubtitle: string;
  essenceTitle: string;
  essenceBody: string;
  stories: EditorialStory[];
  highlightDishIds: string[];
  wineSpotlightId?: string;
  voucherTitle: string;
  voucherBody: string;
  updatedAt: string;
}
