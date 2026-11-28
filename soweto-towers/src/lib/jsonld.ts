import { activities, packages, priceRange, type Activity } from '@/content/catalog';
import { image } from '@/content/images';
import { absoluteUrl, directions, site } from '@/content/site';
import { dayHours } from './hours';
import { addDays } from './time';

/**
 * schema.org structured data. One graph per page, with stable @ids so search
 * engines join the organisation, the place, its products and events together.
 */

const ORG_ID = absoluteUrl('/#organization');
const PLACE_ID = absoluteUrl('/#place');
const SITE_ID = absoluteUrl('/#website');

const sameAs = () => Object.values(site.socials).filter(Boolean);

const postalAddress = () => ({
  '@type': 'PostalAddress',
  streetAddress: site.address.street,
  addressLocality: `${site.address.suburb}, ${site.address.city}`,
  addressRegion: site.address.region,
  addressCountry: site.address.country,
});

export function organization() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: site.name,
    alternateName: site.alternateNames,
    url: site.url,
    logo: { '@type': 'ImageObject', url: absoluteUrl('/icons/icon-512.png'), width: 512, height: 512 },
    email: site.email,
    telephone: site.phone.e164,
    sameAs: sameAs(),
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        telephone: site.phone.e164,
        email: site.email,
        areaServed: 'ZA',
        availableLanguage: ['en', 'zu', 'st'],
      },
    ],
  };
}

export function website() {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: site.url,
    name: site.name,
    alternateName: site.alternateNames,
    inLanguage: 'en-ZA',
    publisher: { '@id': ORG_ID },
  };
}

/** Opening hours with today's sunset as closing time (the page regenerates daily). */
function openingHours(today: string) {
  const byDay: Record<string, string[]> = {};
  for (let i = 0; i < 7; i++) {
    const d = dayHours(addDays(today, i));
    if (!d.open || !d.opensAt) continue;
    const key = `${d.opensAt}-${d.sunset}`;
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${d.date}T12:00:00Z`).getUTCDay()]!;
    (byDay[key] ??= []).push(dayName);
  }
  return Object.entries(byDay).map(([key, days]) => {
    const [opens, closes] = key.split('-');
    return {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days.map((d) => `https://schema.org/${d}`),
      opens,
      closes,
    };
  });
}

export function attraction(today: string) {
  return {
    '@type': ['TouristAttraction', 'SportsActivityLocation'],
    '@id': PLACE_ID,
    name: site.name,
    alternateName: site.alternateNames,
    description:
      'Adventure centre on the painted Orlando Towers, the former Orlando Power Station cooling towers in Soweto: a 100m bungee jump from the bridge between the towers, SCAD freefall, a 700m zipline over the Orlando Dam, paintball and a lift ride to a 360° view.',
    url: site.url,
    telephone: site.phone.e164,
    email: site.email,
    image: [absoluteUrl(image('towers-mural-hero').src), absoluteUrl(image('bungee-between-towers').src), absoluteUrl(image('scad-freefall').src)],
    logo: absoluteUrl('/icons/icon-512.png'),
    address: postalAddress(),
    geo: { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng },
    hasMap: directions.google,
    openingHoursSpecification: openingHours(today),
    priceRange: `R${priceRange.min}–R${priceRange.max.toLocaleString('en-US')}`,
    currenciesAccepted: 'ZAR',
    paymentAccepted: 'Credit card, Debit card',
    isAccessibleForFree: false,
    publicAccess: true,
    touristType: ['Adventure tourism', 'Heritage tourism', 'Groups', 'Corporate team building'],
    parentOrganization: { '@id': ORG_ID },
    sameAs: sameAs(),
    makesOffer: activities
      .filter((a) => a.booking.mode !== 'enquiry')
      .map((a) => ({
        '@type': 'Offer',
        name: a.name,
        price: a.price,
        priceCurrency: 'ZAR',
        url: absoluteUrl(`/adventures/${a.id}`),
      })),
  };
}

export function activityProduct(a: Activity) {
  const img = image(a.image);
  const offers = [
    {
      '@type': 'Offer',
      name: a.name,
      price: a.price,
      priceCurrency: 'ZAR',
      availability: 'https://schema.org/InStock',
      url: absoluteUrl(a.booking.mode === 'enquiry' ? `/adventures/${a.id}` : `/book?activity=${a.id}`),
      seller: { '@id': ORG_ID },
    },
  ];
  if (a.group) {
    offers.push({
      '@type': 'Offer',
      name: `${a.name}, groups of ${a.group.min}+ (per person)`,
      price: a.group.price,
      priceCurrency: 'ZAR',
      availability: 'https://schema.org/InStock',
      url: absoluteUrl(`/book?activity=${a.id}`),
      seller: { '@id': ORG_ID },
    });
  }
  const props = [];
  if (a.rules.minWeightKg) props.push({ '@type': 'PropertyValue', name: 'Minimum weight', value: `${a.rules.minWeightKg} kg` });
  if (a.rules.maxWeightKg) props.push({ '@type': 'PropertyValue', name: 'Maximum weight', value: `${a.rules.maxWeightKg} kg` });
  if (a.rules.minAge) props.push({ '@type': 'PropertyValue', name: 'Minimum age', value: `${a.rules.minAge}` });
  return {
    '@type': 'Product',
    '@id': absoluteUrl(`/adventures/${a.id}#product`),
    name: `${a.name} at Soweto Towers`,
    description: a.seo.description,
    image: absoluteUrl(img.src),
    brand: { '@type': 'Brand', name: site.name },
    category: 'Adventure activity',
    offers,
    additionalProperty: props,
    isRelatedTo: { '@id': PLACE_ID },
  };
}

export function packagesItemList() {
  return {
    '@type': 'ItemList',
    name: 'Soweto Towers jump packages',
    itemListElement: packages.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.name,
        description: p.blurb,
        brand: { '@type': 'Brand', name: site.name },
        offers: { '@type': 'Offer', price: p.price, priceCurrency: 'ZAR', url: absoluteUrl(`/book?package=${p.id}`) },
      },
    })),
  };
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...items].map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function faqPage(qas: { q: string; a: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: qas.map((qa) => ({
      '@type': 'Question',
      name: qa.q,
      acceptedAnswer: { '@type': 'Answer', text: qa.a },
    })),
  };
}

export type EventLd = {
  slug: string;
  title: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  image: string;
  price: number | null;
  soldOut: boolean;
  cancelled?: boolean;
};

export function eventLd(e: EventLd) {
  return {
    '@type': 'Event',
    '@id': absoluteUrl(`/events/${e.slug}#event`),
    name: e.title,
    description: e.summary,
    startDate: e.startsAt,
    endDate: e.endsAt,
    eventStatus: e.cancelled ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: [absoluteUrl(e.image)],
    location: {
      '@type': 'Place',
      name: site.name,
      address: postalAddress(),
      geo: { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng },
    },
    organizer: { '@type': 'Organization', name: site.name, url: site.url },
    offers: {
      '@type': 'Offer',
      price: e.price ?? 0,
      priceCurrency: 'ZAR',
      availability: e.soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      url: absoluteUrl(`/events/${e.slug}`),
    },
  };
}

export function restaurantLd(menu: { section: string; items: { name: string; description: string }[] }[]) {
  return {
    '@type': 'Restaurant',
    '@id': absoluteUrl('/restaurant#restaurant'),
    name: 'Chaf-Pozi at Soweto Towers',
    servesCuisine: ['South African', 'Shisanyama', 'Braai'],
    acceptsReservations: true,
    address: postalAddress(),
    geo: { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng },
    url: absoluteUrl('/restaurant'),
    image: absoluteUrl(image('shisanyama-platter').src),
    containedInPlace: { '@id': PLACE_ID },
    hasMenu: {
      '@type': 'Menu',
      hasMenuSection: menu.map((s) => ({
        '@type': 'MenuSection',
        name: s.section,
        hasMenuItem: s.items.map((i) => ({ '@type': 'MenuItem', name: i.name, description: i.description })),
      })),
    },
  };
}

export function article(a: { slug: string; title: string; description: string; published: string; image: string }) {
  return {
    '@type': 'BlogPosting',
    '@id': absoluteUrl(`/journal/${a.slug}#article`),
    headline: a.title,
    description: a.description,
    datePublished: a.published,
    dateModified: a.published,
    image: absoluteUrl(a.image),
    author: { '@type': 'Organization', name: site.name, url: site.url },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: absoluteUrl(`/journal/${a.slug}`),
    inLanguage: 'en-ZA',
  };
}

export function graph(...nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
