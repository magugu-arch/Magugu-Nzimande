/**
 * Content models, shaped after section 8 of the brief so each one maps onto a
 * headless-CMS document type without renaming fields. Every record says where
 * its facts came from and when someone last checked them; nothing on the site
 * is allowed to be unsourced.
 */

/** Section 7: draft → active/waitlist/closed → archived. */
export type PublishStatus = 'draft' | 'active' | 'waitlist' | 'closed' | 'archived';

export interface Governance {
  /** Where the facts on this record came from — a URL or a named person. */
  source: string;
  /** ISO date someone last confirmed the record against its source. */
  lastReviewed: string;
  /** Things an authorised representative still has to confirm. Empty means none. */
  needsConfirmation: readonly string[];
  /**
   * DEMO ONLY fixtures exist so the layout can be built and tested. They are
   * filtered out at the data layer whenever SITE_MODE is `production`.
   */
  isDemo?: boolean;
}

export type AssetStatus =
  | 'reference-only'
  | 'concept-visual'
  | 'illustrative-concept'
  | 'placeholder-not-official'
  | 'approved';

export interface MediaAsset {
  /** MG-xx from Appendix B; MG-33 onwards were supplied after the brief. */
  id: string;
  file: string;
  width: number;
  height: number;
  alt: string;
  placement: string;
  status: AssetStatus;
  note: string;
  /** Where the subject sits, for object-position when the image is cropped. */
  focus?: string;
  creator: string;
  license: string;
  subjectApproval: 'pending' | 'approved';
  /** True for anything that depicts a product's artwork (book covers). */
  productArtwork?: boolean;
}

export interface Cta {
  label: string;
  href: string;
  /** External destinations open the official platform; tracked as outbound. */
  external?: boolean;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface Program extends Governance {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  /** Who it suits. */
  bestFit: string[];
  /** Who it does not suit — published only once approved. */
  notFor: string[];
  /** Areas of focus. Never phrased as guaranteed results. */
  focus: string[];
  format: string | null;
  duration: string | null;
  /** Null means "see current details" on the official page. Never invented. */
  priceDisplay: string | null;
  cta: Cta;
  status: PublishStatus;
  faqs: Faq[];
  image: string;
  /** Lower first. */
  order: number;
  category: 'challenge' | 'coaching' | 'mastermind' | 'course';
}

/**
 * Selling a book on this site through the cart and Stripe Checkout. Without
 * it (or without a price) the book keeps its official purchase link only.
 */
export interface BookShop {
  /**
   * Price per copy in US cents, copied from the authorised price list. Null
   * until confirmed. Never estimated.
   */
  priceCents: number | null;
  /**
   * PREVIEW ONLY: a labelled stand-in so the cart and checkout can be
   * reviewed before prices are confirmed. Ignored in production.
   */
  demoPriceCents?: number;
  /** Most copies of this book in one order. */
  maxPerOrder: number;
}

export interface Book extends Governance {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  /** Myron's role, which the brief says to confirm for anthologies. */
  role: 'author' | 'contributor' | 'unconfirmed';
  synopsis: string;
  idealReader: string[];
  topics: string[];
  formats: string[];
  publisher: string | null;
  isbn: string | null;
  buy: Cta | null;
  /** Sold on this site through the cart; null keeps the official link only. */
  shop: BookShop | null;
  /** Asset id. Mock-ups are flagged in the asset register and labelled on the page. */
  cover: string | null;
  status: PublishStatus;
  order: number;
}

export type EventFormat = 'online' | 'in-person';
export type EventType = 'workshop' | 'keynote' | 'live-training' | 'networking' | 'fireside';

/**
 * Booking on this site, with payment through Stripe Checkout. An event with
 * an outside `ticketUrl` keeps sending people there instead.
 */
export interface EventBooking {
  /** `open` takes bookings; `closed` and `sold-out` show why not. */
  status: 'open' | 'closed' | 'sold-out';
  /** What one seat is called on the form, the receipt and Stripe. */
  ticketName: string;
  /**
   * Price of one seat in US cents, copied from the authorised price list.
   * 0 means free registration. Null means the price is not confirmed: the
   * form takes a booking request and nobody is asked to pay. Never estimated.
   */
  priceCents: number | null;
  /** Most seats one order can hold. */
  maxPerOrder: number;
}

export interface SiteEvent extends Governance {
  id: string;
  slug: string;
  title: string;
  type: EventType;
  format: EventFormat;
  /** ISO 8601 with offset. */
  start: string;
  end: string;
  /** IANA zone the event is held in; times display in this zone. */
  timezone: string;
  location: string;
  description: string;
  agenda: string[];
  accessibility: string | null;
  ticketUrl: string | null;
  capacityNote: string | null;
  refundPolicyUrl: string | null;
  registrationCutoff: string | null;
  /** Null: no booking on this site (an outside ticket link, or none yet). */
  booking: EventBooking | null;
  status: PublishStatus;
  image: string;
}

export type Topic =
  | 'offers-value'
  | 'sales-closing'
  | 'business-growth'
  | 'entrepreneurship'
  | 'money-stewardship'
  | 'faith-purpose'
  | 'speaking-content';

export type ContentType = 'video' | 'article' | 'resource';

export interface ContentItem extends Governance {
  id: string;
  slug: string;
  title: string;
  type: ContentType;
  topic: Topic;
  excerpt: string;
  /** Article body, as paragraphs. */
  body: string[];
  /** YouTube video id from the official channel. Null until one is supplied. */
  youtubeId: string | null;
  durationMinutes: number | null;
  publishedOn: string;
  speaker: string;
  transcriptUrl: string | null;
  sourcePlatform: string;
  image: string;
  related: string[];
  status: PublishStatus;
}

export interface Testimonial extends Governance {
  id: string;
  name: string | null;
  role: string | null;
  quote: string | null;
  mediaUrl: string | null;
  context: string | null;
  consentReference: string | null;
  approved: boolean;
}

export interface SocialAccount {
  platform: 'TikTok' | 'YouTube' | 'Instagram' | 'Facebook' | 'X' | 'LinkedIn';
  handle: string | null;
  url: string | null;
  verified: boolean;
  verifiedBy: string | null;
  verifiedOn: string | null;
}

export interface Enquiry {
  id: string;
  category: 'speaking' | 'support' | 'general' | 'partnership' | 'press';
  name: string;
  organisation: string | null;
  summary: string;
  sourcePage: string;
  createdAt: string;
  status: 'new' | 'in-review' | 'replied' | 'closed';
  assignedTo: string | null;
  isDemo: true;
}
