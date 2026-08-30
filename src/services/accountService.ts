import { config } from '@/constants/config';
import type {
  Address,
  AppNotification,
  NotificationPreferences,
  PaymentMethod,
  SupportTopic,
} from '@/types';
import { delay, request } from './apiClient';
import {
  notifications,
  savedAddresses,
  savedPaymentMethods,
  supportTopics,
} from './data/accountData';

/** Mutable copies so mock-mode add/remove operations actually take effect. */
/**
 * A brand-new customer has saved nothing. `seedProfile` lets the audits sign
 * in as that person, which is the one account the seeded data could never
 * represent — and the account every customer has on opening morning.
 */
const blank = config.seedProfile === 'new-customer';

let addressLedger: Address[] = blank ? [] : [...savedAddresses];
let paymentLedger: PaymentMethod[] = blank ? [] : [...savedPaymentMethods];
let notificationLedger: AppNotification[] = [...notifications];

/**
 * The mock's stored favourites, **keyed by customer**.
 *
 * One array, shared by everyone, is what this was first — and it reintroduced
 * the exact defect `favouritesStore.claimFor` exists to prevent. Sign in as
 * one person, heart two dishes, sign out; sign in as somebody else and the
 * pull handed them the first person's list, under a Favourites tab that
 * presents it as their own. `audit:handover` drives precisely that journey and
 * caught it.
 *
 * The mistake was modelling the endpoint wrongly. `GET /v1/account/favourites`
 * is scoped by the caller's token on any real backend, so a global array is
 * not a simplification of that contract — it is a different contract. Hence
 * the map, and hence `customerId` on both functions below: the real
 * implementation ignores it and lets the token do the scoping, but the
 * parameter is what stops the mock drifting away from the endpoint again.
 *
 * Nothing is seeded. There is no canonical demo account to seed *for* — ids
 * are derived from whatever email is typed at sign-in — so any seed would
 * belong to every account, which is the bug. Favourites arrive here by being
 * pushed, which is also how they would arrive in production.
 */
const favouriteLedgers = new Map<string, string[]>();

/**
 * The mock's live ledgers, for other mock endpoints to read.
 *
 * Only the mock layer has any business calling these — a real backend already
 * knows what this customer has saved. They exist because `placeOrder` was
 * resolving an order's address against the seeded array these ledgers were
 * *initialised* from, which is a different thing entirely the moment anybody
 * adds an address: their new address is in the ledger and not in the seed, so
 * the lookup found nothing and the order was recorded without one.
 *
 * The customer saw that on the most reassuring screen in the app. A brand-new
 * account, an address typed in by hand, an order placed — and a confirmation
 * reading "Delivering to: Your address".
 */
export function currentAddresses(): Address[] {
  return addressLedger;
}

export function currentPaymentMethods(): PaymentMethod[] {
  return paymentLedger;
}

export async function fetchAddresses(): Promise<Address[]> {
  if (config.useMockApi) return delay(addressLedger);
  return request<Address[]>('/v1/account/addresses');
}

export type AddressInput = Omit<Address, 'id'>;

export async function createAddress(input: AddressInput): Promise<Address> {
  if (!config.useMockApi) {
    return request<Address>('/v1/account/addresses', { method: 'POST', body: input });
  }

  const address: Address = { ...input, id: `address-${Date.now()}` };
  addressLedger = input.isDefault
    ? [address, ...addressLedger.map((item) => ({ ...item, isDefault: false }))]
    : [...addressLedger, address];
  return delay(address, 400);
}

export async function deleteAddress(addressId: string): Promise<void> {
  if (!config.useMockApi) {
    await request<void>(`/v1/account/addresses/${encodeURIComponent(addressId)}`, {
      method: 'DELETE',
    });
    return;
  }

  addressLedger = addressLedger.filter((address) => address.id !== addressId);
  // Never leave the list without a default.
  if (addressLedger.length > 0 && !addressLedger.some((address) => address.isDefault)) {
    addressLedger = addressLedger.map((address, index) =>
      index === 0 ? { ...address, isDefault: true } : address,
    );
  }
  await delay(null, 250);
}

export async function setDefaultAddress(addressId: string): Promise<Address[]> {
  if (!config.useMockApi) {
    return request<Address[]>(`/v1/account/addresses/${encodeURIComponent(addressId)}/default`, {
      method: 'POST',
    });
  }

  addressLedger = addressLedger.map((address) => ({
    ...address,
    isDefault: address.id === addressId,
  }));
  return delay(addressLedger, 250);
}

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  if (config.useMockApi) return delay(paymentLedger);
  return request<PaymentMethod[]>('/v1/account/payment-methods');
}

export async function deletePaymentMethod(methodId: string): Promise<void> {
  if (!config.useMockApi) {
    await request<void>(`/v1/account/payment-methods/${encodeURIComponent(methodId)}`, {
      method: 'DELETE',
    });
    return;
  }

  paymentLedger = paymentLedger.filter((method) => method.id !== methodId);
  await delay(null, 250);
}

export async function setDefaultPaymentMethod(methodId: string): Promise<PaymentMethod[]> {
  if (!config.useMockApi) {
    return request<PaymentMethod[]>(
      `/v1/account/payment-methods/${encodeURIComponent(methodId)}/default`,
      { method: 'POST' },
    );
  }

  paymentLedger = paymentLedger.map((method) => ({
    ...method,
    isDefault: method.id === methodId,
  }));
  return delay(paymentLedger, 250);
}

/**
 * Hearted products, server side.
 *
 * The list is sent whole rather than as add/remove deltas, and that is the
 * decision that makes the rest of this simple. A favourite is a preference,
 * not a transaction: there is no partial state worth protecting, so the client
 * owns the list, PUTs it entire, and last write wins. A failed push therefore
 * costs nothing — the local copy is still authoritative and the next push
 * carries everything, including whatever the failed one was meant to say.
 *
 * Deltas would need an outbox, ordering and idempotency keys to survive a
 * flaky connection. For a list of hearts that is a great deal of machinery to
 * protect something the customer can redo with one tap.
 */
export async function fetchFavourites(customerId: string): Promise<string[]> {
  if (config.useMockApi) return delay([...(favouriteLedgers.get(customerId) ?? [])]);
  return request<string[]>('/v1/account/favourites');
}

export async function saveFavourites(customerId: string, productIds: string[]): Promise<string[]> {
  if (!config.useMockApi) {
    return request<string[]>('/v1/account/favourites', {
      method: 'PUT',
      body: { productIds },
    });
  }
  favouriteLedgers.set(customerId, [...productIds]);
  return delay([...productIds], 200);
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  if (config.useMockApi) return delay(notificationLedger);
  return request<AppNotification[]>('/v1/account/notifications');
}

export async function markNotificationRead(notificationId: string): Promise<AppNotification[]> {
  if (!config.useMockApi) {
    return request<AppNotification[]>(
      `/v1/account/notifications/${encodeURIComponent(notificationId)}/read`,
      { method: 'POST' },
    );
  }

  notificationLedger = notificationLedger.map((notification) =>
    notification.id === notificationId ? { ...notification, read: true } : notification,
  );
  return delay(notificationLedger, 150);
}

export async function markAllNotificationsRead(): Promise<AppNotification[]> {
  if (!config.useMockApi) {
    return request<AppNotification[]>('/v1/account/notifications/read-all', { method: 'POST' });
  }

  notificationLedger = notificationLedger.map((notification) => ({ ...notification, read: true }));
  return delay(notificationLedger, 150);
}

/**
 * Tell the server what this customer wants to be sent.
 *
 * Every one of these toggles was local. A customer switching off "Promotions"
 * changed a value in AsyncStorage and nothing else, so the promotions kept
 * arriving — the server had never been told. `marketingConsent` is the one
 * that matters most: it is captured at registration and sent, and after that
 * the app offered a switch that reached nobody. Under POPIA a withdrawal of
 * consent to direct marketing has to be actionable, and a switch that only
 * moves a local boolean is worse than no switch at all, because it looks like
 * it worked.
 *
 * `defaultFulfilment` is deliberately not here. What the app pre-selects when
 * it opens is a fact about this handset, and no server needs it.
 *
 * A failure is not swallowed — the caller has to put the toggle back rather
 * than leave somebody believing they have opted out.
 */
export interface RemotePreferences {
  notifications: NotificationPreferences;
  marketingConsent: boolean;
}

export async function updateRemotePreferences(input: RemotePreferences): Promise<void> {
  if (config.useMockApi) {
    await delay(null, 250);
    return;
  }
  await request<void>('/v1/account/preferences', { method: 'PATCH', body: input });
}

export async function fetchSupportTopics(): Promise<SupportTopic[]> {
  if (config.useMockApi) return delay(supportTopics, 150);
  return request<SupportTopic[]>('/v1/support/topics');
}

export interface ContactMessage {
  subject: string;
  message: string;
  orderReference?: string;
}

export async function sendContactMessage(input: ContactMessage): Promise<{ ticketId: string }> {
  if (!config.useMockApi) {
    return request<{ ticketId: string }>('/v1/support/messages', { method: 'POST', body: input });
  }
  return delay({ ticketId: `TKT-${Date.now().toString().slice(-6)}` }, 700);
}
