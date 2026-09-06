import type { Address, AppNotification, PaymentMethod, SupportTopic, UserProfile } from '@/types';
import { formatPrice, groupDigits } from '@/utils/money';
import { menuSnapshot } from './menuData';
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
  /**
   * A located address no branch can reach, which the seed had no example of.
   *
   * `deliveryRange` refuses an address outside every branch's radius, and the
   * only address that had ever exercised anything near it was Mum's place —
   * which has *no* coordinates, so the rule lets it through rather than
   * refusing on a measurement nobody took. The refusal itself, the one that
   * fires when the app does know where somebody is and knows it is too far,
   * had never run against seeded data.
   *
   * Bloemfontein is chosen because bb.q has no branch in the Free State and is
   * unlikely to open one first: the nearest seeded kitchen is nearly 400km
   * away, so this is not a near miss that a radius tweak would silently turn
   * into a hit.
   */
  {
    id: 'address-gran',
    label: "Gran's",
    line1: '18 Kellner Street',
    suburb: 'Westdene',
    city: 'Bloemfontein',
    province: 'Free State',
    postalCode: '9301',
    latitude: -29.1075,
    longitude: 26.2044,
    isDefault: false,
  },
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
  /**
   * A card in its last month, which is the only card that can change its mind.
   *
   * The three above are settled: two expire years out and one expired years
   * ago, so every card in the wallet gives the same answer today, tomorrow and
   * next year. `cardHasExpired` is a comparison against the clock and nothing
   * seeded had ever made it return a *different* answer than it did a moment
   * earlier — which is exactly the state that showed checkout was deciding
   * this once per screen and never again.
   *
   * A card valid through the end of this month and dead on the 1st is also the
   * ordinary case. Everybody's wallet contains one twelve times over.
   */
  {
    id: 'payment-mastercard-lastmonth',
    type: 'card',
    label: 'Mastercard ending 3310',
    last4: '3310',
    /*
      Derived, not typed. A literal here would be a card expiring in some fixed
      month, and the fixture would quietly become a fourth long-expired card
      the month after it was written — still passing every test, testing
      nothing. The same rule the notification copy follows one screen down: a
      fact is derived, never restated beside itself.
    */
    expiry: expiryOfCurrentMonth(),
    brand: 'Mastercard',
    isDefault: false,
  },
];

/**
 * This month, in the two-digit form printed on a card.
 *
 * `cardHasExpired` treats a card as valid through the end of the month it
 * names, so this is a card that works today and does not work on the 1st.
 */
function expiryOfCurrentMonth(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear() % 100).padStart(2, '0');
  return `${month}/${year}`;
}

/**
 * A promotion push, written from the menu rather than typed beside it.
 *
 * The shape a real one takes: a title, a choice, a price, and a photograph of
 * the food. The price is the part worth being careful about — a notification
 * saying "from R155" with `155` typed into it is the same drift `tierNudge`
 * above was written to stop, one screen over. A wings price changes in
 * `menuData` and this sentence would go on advertising the old one to
 * everybody's lock screen.
 *
 * So it is derived: the cheapest wings on the menu, formatted through the same
 * helper every price in the app goes through. Nothing here invents a number.
 * (What those numbers *should* be is still a franchise decision — `audit:launch`
 * carries all 28 of them.)
 */
function wingsPush(): Pick<AppNotification, 'title' | 'body' | 'assetKey' | 'href'> {
  const wings = menuSnapshot.products.filter((product) => product.categoryId === 'wings');
  const cheapest = wings.reduce(
    (lowest, product) => (product.basePrice < lowest.basePrice ? product : lowest),
    wings[0]!,
  );

  // Named from the menu too, so a flavour that is delisted cannot go on being
  // advertised by a sentence nobody thought to look at.
  const flavours = wings
    .map((product) => product.name.replace(/ Wings$/, ''))
    .filter((name) => name !== cheapest.name.replace(/ Wings$/, ''));

  return {
    title: 'Wings, four ways 🎉',
    body: `${cheapest.name.replace(/ Wings$/, '')}, ${listSentence(flavours)}? Take your pick, from ${formatPrice(cheapest.basePrice)}.`,
    assetKey: cheapest.assetKey,
    href: '/menu?category=wings',
  };
}

export const notifications: AppNotification[] = [
  /**
   * The order this actually refers to, and a link that reaches it.
   *
   * It named BBQ-4821 — an order completed three days ago — and said it was
   * on the way, received forty minutes ago. Two false statements on a screen
   * a customer reads, produced by a seed written before there was any live
   * order to point at. There is one now, so it points at that.
   *
   * The link went to `/orders`. An order notification that lands on the list
   * rather than on the order is the app making the customer find the thing it
   * just told them about.
   */
  {
    id: 'notif-1',
    title: 'Your order is on the way',
    body: 'Your driver has collected order BBQ-4830 and is heading to you.',
    receivedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    read: false,
    category: 'order',
    href: '/order/order-4830',
  },
  /**
   * A notification with nowhere to go, which is the shape the seed never had.
   *
   * `AppNotification.category` has four members and only three were ever
   * seeded; `href` is optional and every seeded notification carried one. So
   * the row that has no destination had never rendered — and every row is
   * drawn as a pressable card, which meant a notification like this one
   * presented itself as a button and did nothing when a customer tapped it.
   *
   * A service advisory is the ordinary case for that. Load-shedding delaying
   * a kitchen is not a screen anybody can be sent to; it is a thing to be
   * told. The copy names no schedule and no stage, because neither is
   * something this repository knows.
   */
  /**
   * The first notification with a photograph on it (§9, §11).
   *
   * Sits second so the list shows one of each shape in the first two rows —
   * an order update with no artwork, and a promotion with it — which is what
   * makes the row's two layouts visible in a single screenshot.
   */
  {
    id: 'notif-6',
    ...wingsPush(),
    receivedAt: new Date(Date.now() - 35 * 60_000).toISOString(),
    read: false,
    category: 'promotion',
  },
  {
    id: 'notif-5',
    title: 'Load-shedding may delay orders tonight',
    body: 'Some kitchens are on backup power. Collection is quickest if you are nearby.',
    receivedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    read: false,
    category: 'system',
  },
  /**
   * A push about an order that is no longer there.
   *
   * Every seeded notification pointed at something the app can show. A push
   * lives on a lock screen for weeks and an order ledger does not keep
   * everything for ever, so a row whose `href` resolves to nothing is the
   * ordinary end state of an old notification — and the app had never been
   * asked to follow one. `+not-found` and the order screen's own not-found
   * branch are what catch it; this is what makes them reachable from a real
   * row rather than only by typing a URL.
   */
  /**
   * A list long enough to scroll, which the seed had never had.
   *
   * Seven rows fit on a phone with room to spare, so the notifications screen
   * had only ever been rendered as a short list — no scrolling, no read/unread
   * mix past the fold, and the "Mark all read" control always in view. Somebody
   * who has used the app for a season has dozens. These are the ordinary
   * shapes: order updates that came and went, and promotions that expired.
   */
  {
    id: 'notif-8',
    title: 'Your order is on its way',
    body: 'BBQ-4795 has left bb.q Chicken Fourways.',
    receivedAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
    read: true,
    category: 'order',
    href: '/order/order-4795',
  },
  {
    id: 'notif-9',
    title: 'Double points this weekend',
    body: 'Every order earns twice the points from Friday to Sunday.',
    receivedAt: new Date(Date.now() - 11 * 86_400_000).toISOString(),
    read: true,
    category: 'promotion',
    href: '/rewards',
  },
  {
    id: 'notif-10',
    title: 'Free French Fries is ready to claim',
    body: 'You have enough points. It is waiting in your rewards.',
    receivedAt: new Date(Date.now() - 13 * 86_400_000).toISOString(),
    read: true,
    category: 'reward',
    href: '/rewards/reward-fries',
  },
  {
    id: 'notif-11',
    title: 'Thanks for rating BBQ-4610',
    body: 'Your feedback goes straight to the branch.',
    receivedAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
    read: true,
    category: 'order',
    href: '/order/order-4610',
  },
  {
    id: 'notif-12',
    title: 'Your card was charged',
    body: 'R 324.00 for BBQ-4821, paid with Visa ending 4821.',
    receivedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    read: true,
    category: 'system',
  },
  {
    id: 'notif-7',
    title: 'Your order is on its way',
    body: 'BBQ-3980 has left bb.q Chicken Sandton City.',
    receivedAt: new Date(Date.now() - 71 * 86_400_000).toISOString(),
    read: true,
    category: 'order',
    href: '/order/order-3980',
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
