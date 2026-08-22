import type {
  Address,
  AppNotification,
  PaymentMethod,
  SupportTopic,
  UserProfile,
} from '@/types';

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
  {
    id: 'payment-snapscan',
    type: 'snapscan',
    label: 'SnapScan',
    isDefault: false,
  },
  {
    id: 'payment-eft',
    type: 'eft',
    label: 'Instant EFT',
    isDefault: false,
  },
  {
    id: 'payment-cash',
    type: 'cash',
    label: 'Cash on delivery',
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
    answer:
      'You earn 1 point per R1 spent on food, and more as you move up tiers. Points can be redeemed for free items and discounts from the Rewards tab.',
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
