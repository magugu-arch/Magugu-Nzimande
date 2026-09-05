import type { FoodAssetKey } from '@/constants/foodAssets';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  /** E.164, South African numbers (+27…). */
  phone: string;
  dateOfBirth?: string;
  avatarInitials: string;
  isGuest: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  orderUpdates: boolean;
  promotions: boolean;
  rewards: boolean;
  newProducts: boolean;
  channelPush: boolean;
  channelEmail: boolean;
  channelSms: boolean;
}

export interface AppPreferences {
  defaultFulfilment: 'delivery' | 'collection' | 'dinein';
  marketingConsent: boolean;
  /** Hides spice badges and hot items first for heat-averse customers. */
  preferMildFirst: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: UserProfile;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  receivedAt: string;
  read: boolean;
  category: 'order' | 'promotion' | 'reward' | 'system';
  href?: string;
  /**
   * Artwork, for the notifications that arrive with a photograph.
   *
   * Every push a quick-service chain actually sends looks like this: a title,
   * a line of copy, and a picture of the food. The app had no room for the
   * third — the row drew a category icon in a rounded square and nothing
   * else — so a promotion about chicken arrived looking exactly like a
   * password reset. Twenty-eight photographs in the catalogue and the one
   * screen most like a real push notification used none of them.
   *
   * Optional, because most notifications have no photograph to show: an order
   * update, a tier nudge and a service advisory are all text. The row keeps
   * the category icon when this is absent.
   */
  assetKey?: FoodAssetKey;
}

export interface SupportTopic {
  id: string;
  question: string;
  answer: string;
  category: 'orders' | 'delivery' | 'payments' | 'rewards' | 'account';
}
