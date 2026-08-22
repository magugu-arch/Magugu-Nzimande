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
}

export interface SupportTopic {
  id: string;
  question: string;
  answer: string;
  category: 'orders' | 'delivery' | 'payments' | 'rewards' | 'account';
}
