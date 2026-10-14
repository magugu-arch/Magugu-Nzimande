import { official } from './site';
import type { Book } from './types';

/**
 * Books (brief §6). Titles and purchase destinations are confirmed on the
 * official homepage. Synopses, formats, publishers and ISBNs are not, so they
 * are kept minimal or left empty rather than guessed. The covers shown are
 * generated mock-ups and are labelled as placeholders wherever they appear.
 *
 * No price is confirmed, so `priceCents` is null for every book. The two
 * active books carry a DEMO price, used only in preview and labelled there,
 * so the cart and checkout can be reviewed end to end.
 */
export const books: Book[] = [
  {
    id: 'book-boss-moves',
    slug: 'boss-moves',
    title: 'B.O.S.S. Moves',
    subtitle: null,
    role: 'author',
    synopsis:
      'A business strategy book centred on offers — how they are built, and how they move a business forward. The approved synopsis will replace this summary.',
    idealReader: [
      'Entrepreneurs building or refining an offer',
      'Coaches, consultants and service providers',
    ],
    topics: ['Business strategy', 'Offers'],
    formats: [],
    publisher: null,
    isbn: null,
    buy: { label: 'Get the book', href: official.bossMoves, external: true },
    shop: { priceCents: null, demoPriceCents: 2000, maxPerOrder: 10 },
    cover: 'MG-11',
    status: 'active',
    order: 1,
    source: official.home,
    lastReviewed: '2026-10-13',
    needsConfirmation: [
      'Exact approved cover artwork',
      'Approved synopsis',
      'Formats, publisher and ISBN',
      'Current purchase destination and checkout details',
      'Price per copy for selling on this site (the cart shows a demo price until then)',
    ],
  },
  {
    id: 'book-trash-man',
    slug: 'from-the-trash-man-to-the-cash-man',
    title: 'From the Trash Man to the Cash Man',
    subtitle: null,
    role: 'author',
    synopsis:
      'One of the two books featured on the official site, with its own purchase page. The approved synopsis will replace this summary.',
    idealReader: [],
    topics: [],
    formats: [],
    publisher: null,
    isbn: null,
    buy: { label: 'Get the book', href: official.trashManCashMan, external: true },
    shop: { priceCents: null, demoPriceCents: 2000, maxPerOrder: 10 },
    cover: 'MG-19',
    status: 'active',
    order: 2,
    source: official.home,
    lastReviewed: '2026-10-13',
    needsConfirmation: [
      'Exact approved cover artwork',
      'Approved synopsis, reader and topics',
      'Formats, publisher and ISBN',
      'Current purchase destination and checkout details',
      'Price per copy for selling on this site (the cart shows a demo price until then)',
    ],
  },
  {
    id: 'book-mdi',
    slug: 'million-dollar-identity',
    title: 'Million Dollar Identity',
    subtitle: null,
    role: 'unconfirmed',
    synopsis:
      'Promoted on the official homepage. Myron’s author or contributor credit, and the rights to show its cover, are still to be confirmed.',
    idealReader: [],
    topics: [],
    formats: [],
    publisher: null,
    isbn: null,
    buy: null,
    shop: null,
    cover: null,
    status: 'draft',
    order: 3,
    source: official.home,
    lastReviewed: '2026-10-13',
    needsConfirmation: ['Author or contributor credit', 'Cover rights', 'Purchase destination'],
  },
];
