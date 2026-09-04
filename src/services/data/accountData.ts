import type { Address, AppNotification, PaymentMethod, SupportTopic, UserProfile } from '@/types';
import { groupDigits } from '@/utils/money';
import {
  earnRateLine,
  listSentence,
  loyaltyAccount,
  nextTierOf,
  programmeEarnRateLine,
  tierNamed,
} from './rewardsData';

/**
 * The "you are almost at the next tier" nudge, written from where the member
 * actually stands.
 *
 * Every word of this was typed out: *"You're 2 160 points from Gold"* over
 * *"Gold unlocks free delivery every week and priority in the kitchen queue"*.
 * The gap restated a subtraction the ladder already does, and the perks
 * restated Gold's own list — so a change to a threshold or a perk left this
 * notification quietly advertising the old programme. It is the same drift the
 * tier earn rate had, one screen over.
 *
 * The earn rate joins the list only when the next tier actually pays better
 * than the one the member is on. `perksFor` puts it first unconditionally,
 * which is right on the rewards screen, where each tier is read on its own —
 * and wrong here, where the sentence says the word *unlocks*. Every tier pays
 * 1 today, so "Gold unlocks 1 point per R1 spent" would offer a member the
 * rate they already earn.
 */
function tierNudge(): { title: string; body: string } {
  const next = nextTierOf(loyaltyAccount);
  if (!next) {
    return {
      title: `You're at ${loyaltyAccount.tierName}`,
      body: `${loyaltyAccount.tierName} is the top of bb.q Rewards. Everything is unlocked.`,
    };
  }

  const current = tierNamed(loyaltyAccount.tierName);
  const gains =
    next.pointsPerRand > current.pointsPerRand
      ? [earnRateLine(next.pointsPerRand), ...next.perks]
      : next.perks;

  // Perks are written as list items — "Free delivery every week" — and land
  // here mid-sentence. Only the leading character is lowered, so a perk naming
  // something proper keeps it.
  const midSentence = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

  return {
    title: `You're ${groupDigits(loyaltyAccount.pointsToNextTier)} points from ${next.name}`,
    body: `${next.name} unlocks ${listSentence(gains.map(midSentence))}.`,
  };
}

/**
 * An ISO date of birth in whatever month it is now.
 *
 * The day is clamped to the month's length so a 31st never rolls into the
 * next month — which would put the seeded customer's birthday one month out
 * and quietly undo the point of the fixture.
 */
function birthdayThisMonth(year: number, day: number): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const lastDay = new Date(now.getFullYear(), month, 0).getDate();
  const safeDay = Math.min(day, lastDay);

  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export const demoUser: UserProfile = {
  id: 'user-demo',
  firstName: 'Thandi',
  lastName: 'Mokoena',
  email: 'thandi@example.co.za',
  phone: '+27821234567',
  /**
   * A birthday in the current month, which is the one month of twelve that
   * makes the birthday reward reachable.
   *
   * This was a fixed `1994-07-12`. Eleven months in twelve the Birthday
   * Boneless Box was *correctly* locked, which is exactly why nobody looked at
   * it: the twelfth read like a date somebody had not got round to. Behind it,
   * `fetchRewards` excluded the whole category outright, so the reward that
   * says "Unlocks automatically during your birthday month" — four times, on
   * two screens — would have stayed locked in July too.
   *
   * Relative, so the seeded customer is always in their birthday month. That
   * is the state a twelfth of a real customer base is in on any given day, and
   * the only one in which the reward is supposed to do anything.
   */
  dateOfBirth: birthdayThisMonth(1994, 12),
  avatarInitials: 'TM',
  isGuest: false,
  /**
   * Phone verified, email not — which is what almost every real account looks
   * like.
   *
   * The signup flow walks a customer through an OTP screen, so the number gets
   * confirmed. The email link arrives in an inbox later and most people never
   * click it. The seed had both `true`, so the profile screen's unverified
   * branches — the warning badge and the "Send me the link" button — rendered
   * for nobody: the browser sweep visits `/account/profile` as this user and
   * only ever saw the two success badges.
   *
   * This is also the state the launch audit describes as permanent by
   * construction, since `register` creates every customer unverified. Seeding
   * it puts the way out of that state on a screen somebody looks at.
   */
  emailVerified: false,
  phoneVerified: true,
  createdAt: new Date(Date.now() - 220 * 86_400_000).toISOString(),
};

export const savedAddresses: Address[] = [
  {
    id: 'address-home',
    label: 'Home',
    line1: '14 Acacia Road',
    line2: 'Unit 3',
    suburb: 'Melrose Arch',
    city: 'Johannesburg',
    province: 'Gauteng',
    postalCode: '2196',
    latitude: -26.1327,
    longitude: 28.0673,
    instructions: 'Buzzer 3 at the gate. Please call on arrival.',
    isDefault: true,
  },
  {
    id: 'address-work',
    label: 'Work',
    line1: '5 Alice Lane',
    line2: '12th floor reception',
    suburb: 'Sandton',
    city: 'Johannesburg',
    province: 'Gauteng',
    postalCode: '2196',
    latitude: -26.1063,
    longitude: 28.0567,
    instructions: 'Leave at reception, they will call me.',
    isDefault: false,
  },
  /**
   * Typed in, and never located — which is what almost every real address in
   * this app is.
   *
   * The other two carry coordinates, and that made the seed unrepresentative
   * in the one direction that matters: the add-address form is six text fields
   * with no geocoder behind it, so a customer who adds an address gets exactly
   * this. Two rules hang off the difference and neither had a seeded example
   * to run against — `deliveryRange` lets an unlocated address through rather
   * than refusing it on a coordinate nobody measured, and `courierRefusal`
   * declines to read a provider's "cannot route there" as a courier's refusal.
   *
   * Both are written to treat absent coordinates as "nobody knows". This is
   * the fixture that proves they do.
   */
  {
    id: 'address-mum',
    label: "Mum's place",
    line1: '27 Protea Avenue',
    suburb: 'Northcliff',
    city: 'Johannesburg',
    province: 'Gauteng',
    postalCode: '2195',
    instructions: 'Green gate, second driveway.',
    isDefault: false,
  },
];

/**
 * Saved *cards*, and nothing else.
 *
 * This list used to carry SnapScan, Instant EFT and Cash on delivery too,
 * which made checkout look fine against the mock and hid the fact that a
 * customer with no saved card was offered nothing at all. Those are rails the
 * business accepts, not things anyone saves; they live in
 * `features/checkout/paymentOptions`.
 */
export const savedPaymentMethods: PaymentMethod[] = [
  {
    id: 'payment-visa',
    type: 'card',
    label: 'Visa ending 4821',
    last4: '4821',
    expiry: '09/28',
    brand: 'Visa',
    isDefault: true,
  },
  {
    id: 'payment-mastercard',
    type: 'card',
    label: 'Mastercard ending 7702',
    last4: '7702',
    expiry: '03/27',
    brand: 'Mastercard',
    isDefault: false,
  },
  /**
   * A card that has run out, which every wallet eventually contains.
   *
   * Both other cards expire years from now, so nothing in the app had ever
   * held a card it could not pay with. `expiry` was carried on the type,
   * printed on two screens as "Expires 03/27", and compared to the clock
   * nowhere at all — so an expired card was offered at checkout as an ordinary
   * option and the customer found out it was dead from the gateway, after
   * committing to the order.
   */
  {
    id: 'payment-visa-expired',
    type: 'card',
    label: 'Visa ending 1194',
    last4: '1194',
    expiry: '03/24',
    brand: 'Visa',
    isDefault: false,
  },
];

export const notifications: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'Your order is on the way',
    body: 'Sipho has collected order BBQ-4821 and is heading to you.',
    receivedAt: new Date(Date.now() - 40 * 60_000).toISOString(),
    read: false,
    category: 'order',
    href: '/orders',
  },
  {
    id: 'notif-2',
    title: 'Spicy Tuesday is back',
    body: '15% off every Hot Spicy box today. Code SPICY15.',
    receivedAt: new Date(Date.now() - 20 * 3_600_000).toISOString(),
    read: false,
    category: 'promotion',
    href: '/offers',
  },
  {
    id: 'notif-3',
    ...tierNudge(),
    receivedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    read: true,
    category: 'reward',
    href: '/rewards',
  },
  {
    id: 'notif-4',
    title: 'Rose Ddeok-Bokki has landed',
    body: 'Creamy, blush-pink and a gentler heat. Now on the menu.',
    receivedAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    read: true,
    category: 'promotion',
    href: '/product/rose-ddeok-bokki',
  },
];

export const supportTopics: SupportTopic[] = [
  {
    id: 'help-track',
    question: 'How do I track my order?',
    answer:
      'Open Orders from the bottom navigation and tap your active order. You will see live status from Received through to Completed, plus your estimated time.',
    category: 'orders',
  },
  {
    id: 'help-change',
    question: 'Can I change or cancel my order?',
    answer:
      'You can cancel while the order is still in Received. Once the kitchen starts preparing, call the store directly on the number shown on your order and they will help where they can.',
    category: 'orders',
  },
  {
    id: 'help-delivery-time',
    question: 'How long does delivery take?',
    answer:
      'Most deliveries arrive in 35 to 50 minutes depending on your distance from the store and how busy the kitchen is. Your live estimate is always shown on the order.',
    category: 'delivery',
  },
  {
    id: 'help-delivery-fee',
    question: 'What does delivery cost?',
    answer:
      'Delivery is R32 within our standard zones, and free on orders over R350. The exact fee is always shown before you pay.',
    category: 'delivery',
  },
  {
    id: 'help-payment',
    question: 'Which payment methods can I use?',
    answer:
      'Visa and Mastercard, Instant EFT, SnapScan, Apple Pay and Google Pay. Cash is available on delivery orders at selected stores.',
    category: 'payments',
  },
  {
    id: 'help-refund',
    question: 'Something was missing from my order',
    answer:
      'We are sorry. Open the order, tap Contact us and tell us what was missing. We will refund or replace it, usually within one business day.',
    category: 'payments',
  },
  {
    id: 'help-points',
    question: 'How do bb.q Rewards points work?',
    // The rate comes off the ladder. Typed out here it read "1 point per R1
    // spent on food, and more as you move up tiers" while every tier paid the
    // same 1 — a promise in the one place a customer goes to check.
    answer: `${programmeEarnRateLine()}. Points can be redeemed for free items and discounts from the Rewards tab.`,
    category: 'rewards',
  },
  {
    id: 'help-points-expire',
    question: 'Do my points expire?',
    answer:
      'Points expire 12 months after they are earned. Your Rewards screen shows anything expiring in the next 30 days.',
    category: 'rewards',
  },
  {
    id: 'help-delete',
    question: 'How do I delete my account?',
    answer:
      'Go to More, then Profile, and choose Delete account. We remove your personal data within 30 days, keeping only what tax law requires us to retain.',
    category: 'account',
  },
];
