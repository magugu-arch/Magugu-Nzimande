import { routeForNotification } from '@/services/notificationService';

describe('routeForNotification', () => {
  it('uses an explicit href when the server sends one', () => {
    expect(routeForNotification({ href: '/order/order-123' })).toBe('/order/order-123');
  });

  it('ignores an href that is not an in-app path', () => {
    // A payload could carry anything; only our own routes are safe to push.
    expect(routeForNotification({ href: 'https://evil.example/phish' })).toBe(
      '/account/notifications',
    );
    expect(routeForNotification({ href: '' })).toBe('/account/notifications');
  });

  it('falls back to the order when an orderId is present', () => {
    expect(routeForNotification({ orderId: 'order-4821' })).toBe('/order/order-4821');
  });

  it('prefers an explicit href over an orderId', () => {
    expect(routeForNotification({ href: '/(tabs)/rewards', orderId: 'order-1' })).toBe(
      '/(tabs)/rewards',
    );
  });

  it('routes by category when nothing more specific is given', () => {
    expect(routeForNotification({ category: 'order' })).toBe('/(tabs)/orders');
    expect(routeForNotification({ category: 'promotion' })).toBe('/offers');
    expect(routeForNotification({ category: 'reward' })).toBe('/(tabs)/rewards');
    expect(routeForNotification({ category: 'system' })).toBe('/account/notifications');
  });

  it('lands somewhere useful for an empty or missing payload', () => {
    expect(routeForNotification(undefined)).toBe('/(tabs)/home');
    expect(routeForNotification({})).toBe('/account/notifications');
  });

  it('survives a malformed payload rather than throwing', () => {
    expect(() => routeForNotification({ href: 42, orderId: null, category: [] })).not.toThrow();
    expect(routeForNotification({ href: 42, orderId: null, category: [] })).toBe(
      '/account/notifications',
    );
  });
});
