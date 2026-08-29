import { STORES } from '@bbq/seed';
import {
  CreateOrderRequestSchema,
  CustomerSchema,
  ORDER_STATES,
  completedLabel,
  statesForMode,
} from '@bbq/types';
import { describe, expect, it } from 'vitest';
import { isOpenNow, minutesNowInSast } from '@/lib/trading';

describe('order states', () => {
  it('run received to completed, in order', () => {
    expect(ORDER_STATES).toEqual([
      'received',
      'preparing',
      'ready',
      'out_for_delivery',
      'completed',
    ]);
  });

  it('keep out_for_delivery only for delivery', () => {
    expect(statesForMode('Delivery')).toContain('out_for_delivery');
    expect(statesForMode('Collection')).not.toContain('out_for_delivery');
    expect(statesForMode('Dine-in')).not.toContain('out_for_delivery');
  });

  it('relabel the last step by how the order is being fulfilled', () => {
    expect(completedLabel('Delivery')).toBe('Delivered');
    expect(completedLabel('Collection')).toBe('Collected');
    expect(completedLabel('Dine-in')).toBe('Served');
  });
});

describe('customer details', () => {
  const valid = { name: 'Thandi Mokoena', email: 'thandi@example.com', mobile: '0821234567' };

  it('accept a well-formed customer', () => {
    expect(CustomerSchema.safeParse(valid).success).toBe(true);
  });

  it('accept the ways a South African writes a mobile number', () => {
    for (const mobile of [
      '0821234567',
      '082 123 4567',
      '082-123-4567',
      '+27821234567',
      '+27 82 123 4567',
      '(082) 123 4567',
    ]) {
      expect(CustomerSchema.safeParse({ ...valid, mobile }).success, mobile).toBe(true);
    }
  });

  it('refuse a number that is not a South African mobile', () => {
    for (const mobile of ['0121234567', '12345', '082123456', 'not a number']) {
      expect(CustomerSchema.safeParse({ ...valid, mobile }).success, mobile).toBe(false);
    }
  });

  it('refuse a malformed email and an empty name', () => {
    expect(CustomerSchema.safeParse({ ...valid, email: 'thandi@' }).success).toBe(false);
    expect(CustomerSchema.safeParse({ ...valid, name: 'T' }).success).toBe(false);
  });
});

describe('order requests', () => {
  const line = {
    key: 'golden-original::',
    slug: 'golden-original',
    name: 'Golden Original Chicken',
    imageKey: 'golden-original',
    quantity: 1,
    unitCents: 18_900,
    options: [],
  };
  const base = {
    storeId: 'ST-CRE',
    customer: { name: 'Thandi Mokoena', email: 'thandi@example.com', mobile: '0821234567' },
    lines: [line],
    promoCode: null,
    kitchenNote: '',
  };

  it('refuse an empty basket', () => {
    const parsed = CreateOrderRequestSchema.safeParse({ ...base, mode: 'Collection', lines: [] });
    expect(parsed.success).toBe(false);
  });

  it('require an address and suburb for delivery', () => {
    expect(CreateOrderRequestSchema.safeParse({ ...base, mode: 'Delivery' }).success).toBe(false);
    expect(
      CreateOrderRequestSchema.safeParse({
        ...base,
        mode: 'Delivery',
        address: '12 Beyers Naude Drive',
        suburb: 'Randburg',
      }).success,
    ).toBe(true);
  });

  it('do not require an address for collection or dine-in', () => {
    expect(CreateOrderRequestSchema.safeParse({ ...base, mode: 'Collection' }).success).toBe(true);
    expect(CreateOrderRequestSchema.safeParse({ ...base, mode: 'Dine-in' }).success).toBe(true);
  });

  it('cap the kitchen note rather than passing on an essay', () => {
    const parsed = CreateOrderRequestSchema.safeParse({
      ...base,
      mode: 'Collection',
      kitchenNote: 'x'.repeat(281),
    });
    expect(parsed.success).toBe(false);
  });
});

describe('trading hours', () => {
  const cresta = STORES.find((store) => store.id === 'ST-CRE');
  if (!cresta) throw new Error('Expected the Cresta Crossing store to be seeded');

  it('reads the clock in South African time', () => {
    const minute = minutesNowInSast(new Date('2026-08-29T10:00:00Z'));
    expect(minute).toBe(12 * 60);
  });

  it('is open inside the window and closed outside it', () => {
    expect(isOpenNow(cresta, new Date('2026-08-29T12:00:00Z'))).toBe(true);
    expect(isOpenNow(cresta, new Date('2026-08-29T06:00:00Z'))).toBe(false);
    expect(isOpenNow(cresta, new Date('2026-08-29T21:00:00Z'))).toBe(false);
  });

  it('is closed exactly at closing and open exactly at opening', () => {
    // 11:00 SAST is 09:00 UTC; 22:00 SAST is 20:00 UTC.
    expect(isOpenNow(cresta, new Date('2026-08-29T09:00:00Z'))).toBe(true);
    expect(isOpenNow(cresta, new Date('2026-08-29T20:00:00Z'))).toBe(false);
  });
});
