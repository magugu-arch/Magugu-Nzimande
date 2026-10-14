/**
 * Biography drafted from the official About page (research register [2]).
 * It keeps to what the brief lists as confirmed and adds nothing: no
 * rankings, revenue, audience sizes, stage-sharing claims or "best-selling"
 * language until an authorised representative approves them (brief §2).
 */
export const bio = {
  source: 'https://myrongolden.com/mg-or-about',
  lastReviewed: '2026-10-13',
  needsConfirmation: [
    'Approve short and long biography wording',
    'Approve speaker introduction',
    'Confirm which credentials may be listed (author, speaker, bestseller status)',
  ],
  approved: false,
  short:
    'Myron Golden is a business growth strategist, author and speaker. His teaching brings practical offer creation and sales strategy together with Biblical principles of stewardship, service and purpose.',
  long: [
    'Myron Golden is a business growth strategist, author and speaker who helps entrepreneurs, coaches, consultants and business owners build offers people want and sell them with integrity.',
    'His teaching is practical — how an offer is put together, how a sales conversation is led, how a business grows — and it rests on a conviction that runs through all of his work: that timeless, Biblical principles are a sound foundation for business.',
    'His own story includes overcoming polio, and he speaks openly about the place of faith, family, purpose and service in his life and work. Those themes shape what he teaches as much as any tactic does.',
    'Today he teaches through his books, free training, live challenges, coaching programs and the stage.',
  ],
  speakerIntroduction:
    'Our next speaker is a business growth strategist, author and educator whose teaching joins practical sales and offer strategy with principles that have stood the test of time. Please welcome Myron Golden.',
} as const;

/** Brief §6, About: teaching pillars. */
export const pillars = [
  {
    title: 'Practical business strategy',
    body: 'Clear thinking about what a business sells, to whom, and how it grows — taught so it can be put to work the same week.',
  },
  {
    title: 'Sales and offer creation',
    body: 'How to build an offer worth saying yes to, and how to present it with conviction instead of pressure.',
  },
  {
    title: 'Faith-informed principles',
    body: 'Business decisions measured against timeless, Biblical principles of stewardship, honesty and generosity.',
  },
  {
    title: 'Service, purpose and legacy',
    body: 'Work understood as service to others, and wealth as something to steward for the people who come after.',
  },
] as const;

/** Credibility strip (Home §2): only facts the brief lists as confirmed. */
export const credentials = [
  'Business growth strategist',
  'Author of B.O.S.S. Moves',
  'Speaker and educator',
  'Faith-informed teaching',
] as const;
