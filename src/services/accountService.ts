import { config } from '@/constants/config';
import type { Address, AppNotification, PaymentMethod, SupportTopic } from '@/types';
import { delay, request } from './apiClient';
import {
  notifications,
  savedAddresses,
  savedPaymentMethods,
  supportTopics,
} from './data/accountData';

/** Mutable copies so mock-mode add/remove operations actually take effect. */
let addressLedger: Address[] = [...savedAddresses];
let paymentLedger: PaymentMethod[] = [...savedPaymentMethods];
let notificationLedger: AppNotification[] = [...notifications];

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
