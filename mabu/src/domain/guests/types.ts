/** Brief §19: guests and restaurant staff are separate roles. */
export type Role = 'guest' | 'staff' | 'admin';

/** Who is performing an action — every service call that changes state takes one. */
export interface Actor {
  id: string;
  role: Role;
}

export type DietaryTag = 'vegetarian' | 'vegan' | 'gluten-free' | 'halal' | 'dairy-free' | 'nut-free';

export interface GuestOccasion {
  id: string;
  kind: 'birthday' | 'anniversary' | 'other';
  label: string;
  /** MM-DD — the year is not needed to recognise the day, and not collected. */
  date: string;
}

/** Brief §21 `Guest`, plus the profile fields §16 asks for. */
export interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  createdAt: string;
  preferences?: {
    dietaryTags?: DietaryTag[];
    seatingPreference?: string;
    favouriteCategories?: string[];
    accessibilityNotes?: string;
  };
  occasions?: GuestOccasion[];
  consent?: {
    marketing: boolean;
    updatedAt: string;
    source: string;
  };
  /** Set when the guest opts in to MÁBU Rewards (§34 "after opt-in"). */
  rewardsOptIn?: boolean;
  referralCode?: string;
  referredBy?: string;
}

export type FavouriteKind = 'dish' | 'wine' | 'experience' | 'collection';

export interface Favourite {
  id: string;
  guestId: string;
  kind: FavouriteKind;
  itemId: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorRole: Role;
  action: string;
  entityType: string;
  entityId: string;
  at: string;
  detail?: Record<string, unknown>;
}
