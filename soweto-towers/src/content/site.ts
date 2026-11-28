/**
 * Business facts in one place. Sources: the current sowetotowers.co.za pages
 * (contacts, hours, address) as of 28 Nov 2026. Items marked CONFIRM are listed
 * in README → Content to confirm.
 */

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sowetotowers.co.za').replace(/\/$/, '');

/** Digits only, international format without "+", as wa.me expects. CONFIRM which line runs WhatsApp Business. */
const whatsappDigits = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '27716744343').replace(/\D/g, '');

export const site = {
  name: 'Soweto Towers',
  legalName: 'Soweto Towers',
  alternateNames: ['Orlando Towers', 'Orlando Towers Soweto', 'Soweto Towers Vertical Adventure Centre'],
  descriptor: 'Vertical Adventure Centre',
  tagline: 'Soweto, From The Top.',
  values: ['Brave', 'Proud', 'Playful', 'Safe hands'],
  hashtags: ['#SowetoFromTheTop', '#100mClub'],
  url: siteUrl,
  /** Search engines index only the production deployment. */
  indexable: process.env.NEXT_PUBLIC_SITE_ENV === 'production',
  locale: 'en_ZA',
  currency: 'ZAR',
  timeZone: 'Africa/Johannesburg',

  phone: { display: '071 674 4343', e164: '+27716744343', note: 'Office hours 09:00–17:00' },
  phoneAlt: { display: '064 681 8478', e164: '+27646818478', note: 'Office hours Wednesday to Sunday' },
  whatsapp: {
    digits: whatsappDigits,
    display: `+${whatsappDigits.slice(0, 2)} ${whatsappDigits.slice(2, 4)} ${whatsappDigits.slice(4, 7)} ${whatsappDigits.slice(7)}`,
  },
  email: 'info@sowetotowers.co.za',
  /** Film shoots, photography, location and venue hire, base jumping. */
  emailVenue: 'nico@sowetotowers.co.za',

  address: {
    street: 'Cnr Sheffield Road & Chris Hani Road',
    suburb: 'Orlando East',
    city: 'Soweto',
    metro: 'Johannesburg',
    region: 'Gauteng',
    regionCode: 'ZA-GP',
    country: 'ZA',
    countryName: 'South Africa',
  },
  /** Attraction pin (Sheffield Rd). CONFIRM against the Google Business Profile pin. */
  geo: { lat: -26.254274, lng: 27.926647 },

  socials: {
    facebook: 'https://www.facebook.com/Soweto-Towers-180847421971325/',
    youtube: 'https://www.youtube.com/channel/UCrwAucXu5YsalQ5__AghKeQ',
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || '',
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL || '',
    linkedin: process.env.NEXT_PUBLIC_LINKEDIN_URL || '',
  },

  /** Entrance at the gate, per person. */
  entranceFee: 20,
  cashFree: true,

  /**
   * Weekly opening. Close is always sunset (computed for the towers' location),
   * so only the opening time is stored. 0 = Sunday … 6 = Saturday.
   */
  weeklyOpening: {
    0: '10:00',
    1: null,
    2: null,
    3: null,
    4: '12:00',
    5: '10:00',
    6: '10:00',
  } as Record<number, string | null>,
} as const;

export const directions = {
  google: `https://www.google.com/maps/dir/?api=1&destination=${site.geo.lat},${site.geo.lng}&destination_place_id=&travelmode=driving`,
  apple: `https://maps.apple.com/?daddr=${site.geo.lat},${site.geo.lng}&q=Soweto%20Towers`,
  waze: `https://waze.com/ul?ll=${site.geo.lat},${site.geo.lng}&navigate=yes`,
  uber: `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${site.geo.lat}&dropoff[longitude]=${site.geo.lng}&dropoff[nickname]=Soweto%20Towers`,
  mapEmbed: `https://www.google.com/maps?q=${site.geo.lat},${site.geo.lng}&z=15&output=embed`,
};

export function whatsappLink(text?: string): string {
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${site.whatsapp.digits}${q}`;
}

export function absoluteUrl(path = '/'): string {
  return `${site.url}${path.startsWith('/') ? path : `/${path}`}`;
}
