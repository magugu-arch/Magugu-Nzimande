import { formatMoney, moneyAccessibilityLabel, zar } from '@/core/domain/money';
import {
  formatCountdown,
  formatDayLong,
  formatRelativeDay,
  formatTime,
  greetingFor,
  sastDate,
  sastParts,
} from '@/core/time/sast';
import { scenarioAnchor } from '@/core/time/clock';
import { parseRands } from '@/features/money/amount';
import {
  addItem,
  cartCount,
  cartTotal,
  emptyCart,
  MAX_PER_ITEM,
  removeItem,
} from '@/features/dining/cart';
import { menus } from '@/core/fixtures/campusLife';

describe('money', () => {
  it('formats rand the way the statement does', () => {
    expect(formatMoney(zar(4250))).toBe('R4,250.00');
    expect(formatMoney(zar(-58400))).toBe('−R58,400.00');
    expect(formatMoney(zar(62), { signed: true })).toBe('+R62.00');
    expect(formatMoney(zar(2_000_000), { showCents: false })).toBe('R2,000,000');
  });

  it('reads amounts aloud', () => {
    expect(moneyAccessibilityLabel(zar(4250))).toBe('4250 rand');
    expect(moneyAccessibilityLabel(zar(12.5))).toBe('12 rand 50 cents');
  });

  it('parses typed amounts strictly', () => {
    expect(parseRands('1500')).toBe(150000);
    expect(parseRands('R1,500.50')).toBe(150050);
    expect(parseRands('0')).toBeNull();
    expect(parseRands('12.345')).toBeNull();
    expect(parseRands('abc')).toBeNull();
  });
});

describe('SAST time', () => {
  const t = sastDate(2026, 10, 5, 9, 40);

  it('formats on South African time whatever the device zone', () => {
    expect(t.toISOString()).toBe('2026-10-05T07:40:00.000Z');
    expect(formatTime(t)).toBe('09:40');
    expect(formatDayLong(t)).toBe('Monday 5 October');
    expect(sastParts(t).weekday).toBe(1);
  });

  it('counts down in minutes, hours, then days', () => {
    expect(formatCountdown(sastDate(2026, 10, 5, 10, 0), t)).toBe('in 20 min');
    expect(formatCountdown(sastDate(2026, 10, 5, 12, 5), t)).toBe('in 2 h 25 min');
    expect(formatCountdown(sastDate(2026, 10, 6, 14, 0), t)).toBe('tomorrow');
    expect(formatCountdown(sastDate(2026, 10, 8, 14, 0), t)).toBe('in 3 days');
    expect(formatCountdown(sastDate(2026, 10, 5, 9, 28), t)).toBe('12 min ago');
  });

  it('names relative days and greets by the hour', () => {
    expect(formatRelativeDay(sastDate(2026, 10, 6, 8, 0), t)).toBe('Tomorrow');
    expect(greetingFor(t)).toBe('Good morning');
    expect(greetingFor(sastDate(2026, 10, 5, 15, 0))).toBe('Good afternoon');
    expect(greetingFor(sastDate(2026, 10, 5, 19, 0))).toBe('Good evening');
  });

  it('starts the demo scenario at 09:40 on the next weekday', () => {
    expect(formatTime(scenarioAnchor(sastDate(2026, 10, 5, 20, 0)))).toBe('09:40');
    // Sunday 4 October → Monday 5 October.
    expect(formatDayLong(scenarioAnchor(sastDate(2026, 10, 4, 11, 0)))).toBe('Monday 5 October');
    expect(formatDayLong(scenarioAnchor(sastDate(2026, 10, 3, 11, 0)))).toBe('Monday 5 October');
  });
});

describe('campus order cart', () => {
  const kitchen = menus['campus-kitchen']!;
  const coffee = menus['commons-coffee']!;

  it('adds, counts and totals in cents', () => {
    let cart = addItem(emptyCart(), kitchen[0]!);
    cart = addItem(cart, kitchen[0]!);
    cart = addItem(cart, kitchen[4]!);
    expect(cartCount(cart)).toBe(3);
    expect(cartTotal(cart)).toEqual(zar(62 * 2 + 24));
  });

  it('keeps one vendor per order', () => {
    const cart = addItem(addItem(emptyCart(), kitchen[0]!), coffee[0]!);
    expect(cart.vendorId).toBe('commons-coffee');
    expect(cart.lines).toHaveLength(1);
  });

  it('caps quantities, refuses sold-out items, and empties cleanly', () => {
    let cart = emptyCart();
    for (let i = 0; i < 15; i++) cart = addItem(cart, kitchen[0]!);
    expect(cartCount(cart)).toBe(MAX_PER_ITEM);
    const soldOut = menus['bay-grill']!.find((m) => !m.available)!;
    expect(addItem(emptyCart(), soldOut).lines).toHaveLength(0);
    let one = addItem(emptyCart(), kitchen[1]!);
    one = removeItem(one, kitchen[1]!.id);
    expect(one).toEqual(emptyCart());
  });
});
