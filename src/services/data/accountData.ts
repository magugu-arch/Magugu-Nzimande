import type { Address, AppNotification, PaymentMethod, SupportTopic, UserProfile } from '@/types';

export const demoUser: UserProfile = {
  id: 'user-demo',
  firstName: 'Thandi',
  lastName: 'Mokoena',
  email: 'thandi@example.co.za',
  phone: '+27821234567',
  dateOfBirth: '1994-07-12',
  avatarInitials: 'TM',
  isGuest: false,
  emailVerified: true,
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
];

export const notifications: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'Your order is on the way',
    body: 'Sipho has collected order PPS-4821 and is heading to you.',
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
    title: "You're 2 160 points from Gold",
    body: 'Gold unlocks free delivery every week and priority in the kitchen queue.',
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
    href: '/menu/desserts',
  },
];

/**
 * Help answers.
 *
 * Rewritten for Pappas, and shorter than the set they replace — because most
 * of what a help centre answers is a commercial fact, and §15 forbids
 * inventing those. The previous answers stated a R32 delivery fee, a R350
 * free-delivery threshold, a 35–50 minute delivery window, a 1-point-per-rand
 * earn rate, a 12-month points expiry and a list of accepted payment rails.
 * Every one of those is a customer promise, and nobody has supplied a single
 * one for Pappas.
 *
 * An answer that invents them is worse than no answer: the help centre is
 * exactly where a customer goes to find out what something costs, so a
 * fabricated figure there is a fabricated figure at its most believable.
 *
 * So each answer below either describes how the *app* works — which is a fact
 * this repository knows — or says plainly that the detail is confirmed by the
 * restaurant. `__tests__/quotedPrices.test.ts` fails if a rand figure appears
 * in any of them before the constants agree.
 */
export const supportTopics: SupportTopic[] = [
  {
    id: 'help-track',
    question: 'How do I track my order?',
    answer:
      'Open your order from Account, or tap the status card on Home. You will see it move from ' +
      'Sent to Pappas through Preparing to Ready, with an estimate where we have one.',
    category: 'orders',
  },
  {
    id: 'help-change',
    question: 'Can I change or cancel my order?',
    answer:
      'You can cancel while the order is still waiting to be confirmed. Once the kitchen has ' +
      'started, call the restaurant on the number shown on your order and they will help where ' +
      'they can.',
    category: 'orders',
  },
  {
    id: 'help-reserve',
    question: 'How do I book a table?',
    answer:
      'Tap Reserve and choose a date, a time and how many of you there are. You can add a ' +
      'seating preference or tell us the occasion, and you will get a confirmation you can ' +
      'change or cancel from the app.',
    category: 'orders',
  },
  {
    id: 'help-delivery-fee',
    question: 'What does delivery cost?',
    answer:
      'The delivery fee is shown before you pay, and it depends on where you are. We do not ' +
      'quote a figure here because the one on your order is the one you are charged.',
    category: 'delivery',
  },
  {
    id: 'help-delivery-area',
    question: 'Do you deliver to me?',
    answer:
      'Enter your address at checkout and we will tell you straight away. If we cannot reach ' +
      'you, collection from Nelson Mandela Square is always available.',
    category: 'delivery',
  },
  {
    id: 'help-channels',
    question: 'Can I order through Uber Eats or Mr D?',
    answer:
      'Not yet. Ordering directly with Pappas is available now, and we will announce the other ' +
      'channels in the app when they open.',
    category: 'delivery',
  },
  {
    id: 'help-payment',
    question: 'Which payment methods can I use?',
    answer:
      'The payment options available to you are shown at checkout. If one you expect is ' +
      'missing, tell us through Contact and we will look into it.',
    category: 'payments',
  },
  {
    id: 'help-refund',
    question: 'Something was missing from my order',
    answer:
      'We are sorry. Open the order, tap Contact us and tell us what was missing, and we will ' +
      'put it right.',
    category: 'payments',
  },
  {
    id: 'help-points',
    question: 'How does Pappas Rewards work?',
    answer:
      'Rewards recognises you for coming back — your favourites remembered, invitations to ' +
      'member evenings, and a table held when we can. The full programme details are being ' +
      'confirmed and will appear in the app.',
    category: 'rewards',
  },
  {
    id: 'help-rewards-channels',
    question: 'Do I earn rewards on delivery orders?',
    answer:
      'You earn on orders placed directly with Pappas. Orders placed through a delivery ' +
      'marketplace are handled by that service, so we cannot recognise them.',
    category: 'rewards',
  },
  {
    id: 'help-delete',
    question: 'How do I delete my account?',
    answer:
      'Go to Account, then Profile, and choose Delete account. We remove your personal data ' +
      'within 30 days, keeping only what the law requires us to retain.',
    category: 'account',
  },
];
