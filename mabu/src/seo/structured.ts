/** schema.org data, so a search result can show hours, price range and events. */
import type { Experience } from '@/domain/experiences/types';
import type { Dish } from '@/domain/menu/types';
import type { VenueContent } from '@/content/types';
import { absolute, LOCALITY, OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './site';

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** "12:00 – 23:00" → { opens: '12:00', closes: '23:00' }; closed days are left out. */
function hours(venue: VenueContent) {
  return venue.hours
    .map((h) => {
      const m = h.hours ? /(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/.exec(h.hours) : null;
      return m ? { day: DAY[h.day], opens: m[1], closes: m[2] } : null;
    })
    .filter((x): x is { day: (typeof DAY)[number]; opens: string; closes: string } => !!x)
    .map((x) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${x.day}`,
      opens: x.opens,
      closes: x.closes,
    }));
}

export function restaurantSchema(venue?: VenueContent) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${SITE_URL}/#restaurant`,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    image: OG_IMAGE,
    servesCuisine: ['African', 'Contemporary', 'Steakhouse', 'Seafood'],
    priceRange: 'RRR',
    currenciesAccepted: 'ZAR',
    acceptsReservations: 'True',
    hasMenu: absolute('/menu'),
    address: {
      '@type': 'PostalAddress',
      streetAddress: venue?.addressLines?.[0] ?? 'Waterfall Wilds',
      addressLocality: venue?.addressLines?.[1] ?? LOCALITY,
      addressRegion: 'Gauteng',
      addressCountry: 'ZA',
    },
    ...(venue?.phone ? { telephone: venue.phone } : {}),
    ...(venue?.email ? { email: venue.email } : {}),
    ...(venue ? { openingHoursSpecification: hours(venue) } : {}),
    ...(venue?.latitude && venue?.longitude
      ? { geo: { '@type': 'GeoCoordinates', latitude: venue.latitude, longitude: venue.longitude } }
      : {}),
  };
}

export function eventSchema(event: Experience) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FoodEvent',
    name: event.title,
    description: event.description,
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: absolute(`/events/${event.id}`),
    location: { '@type': 'Restaurant', name: SITE_NAME, address: LOCALITY },
    ...(event.priceCents === null
      ? {}
      : {
          offers: {
            '@type': 'Offer',
            price: (event.priceCents / 100).toFixed(2),
            priceCurrency: 'ZAR',
            availability: 'https://schema.org/InStock',
            url: absolute(`/events/${event.id}`),
          },
        }),
  };
}

export function dishSchema(dish: Dish) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MenuItem',
    name: dish.name,
    description: dish.description,
    url: absolute(`/dish/${dish.id}`),
    offers: {
      '@type': 'Offer',
      price: (dish.priceCents / 100).toFixed(2),
      priceCurrency: 'ZAR',
    },
    ...(dish.dietaryTags.length ? { suitableForDiet: dish.dietaryTags } : {}),
  };
}

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: absolute(t.path),
    })),
  };
}
