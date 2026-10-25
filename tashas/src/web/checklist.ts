/** Brief §13.16 and §10: what Tashas and its providers must supply before going live. */
export const PROVIDER_CHECKLIST: string[] = [
  'Reservation provider: contract, café coverage, availability, hold, create, amend, cancel and waitlist APIs, webhook signing method, rate limits and sandbox credentials.',
  'Payment gateway: merchant account, supported methods (cards, and Apple Pay, Google Pay or instant EFT only if offered), hosted checkout or SDK choice, webhook verification, refunds, settlement exports, disputes and sandbox credentials.',
  'Approved deposit amounts and rules, refund and cancellation policies, no-show approach, booking time limits and per-café overrides.',
  'Notification providers and sender identities for email and push; SMS and WhatsApp providers, senders and approved templates if those channels are wanted.',
  'Approved rewards policy: what earns points, rewards on offer, tiers and expiry.',
  'Privacy notice, consent wording, retention periods and legal sign-off under POPIA and the direct-marketing rules.',
  'Verified café data: addresses, phone numbers, hours, amenities, Google Business Profile links and each café’s “Inspired By” story and imagery.',
  'Approved menus per café: dish names, descriptions, prices, and verified dietary and allergen information.',
  'Maps provider key (for the live map) and analytics / Search Console access, configured as server-side environment variables.',
  'A stable HTTPS domain for the web app and PWA, and the store accounts for any native builds.',
];
