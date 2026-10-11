import { bagCount, MAX_QUANTITY, useBag } from '@/store/bag';
import { useSaved } from '@/store/saved';
import { validateContact } from '@/features/validation';

describe('bag', () => {
  beforeEach(() => useBag.getState().clear());
  const line = { productId: 'p03', variantId: 'p03:M', size: 'M' };

  it('merges identical lines and caps the quantity', () => {
    for (let i = 0; i < MAX_QUANTITY + 3; i++) useBag.getState().add(line);
    expect(useBag.getState().lines).toHaveLength(1);
    expect(bagCount(useBag.getState().lines)).toBe(MAX_QUANTITY);
  });

  it('removes a line and puts it back where it was on Undo', () => {
    useBag.getState().add(line);
    useBag.getState().add({ productId: 'p11', variantId: 'p11:S/M', size: 'S/M' });
    const removed = useBag.getState().remove('p03:M')!;
    expect(useBag.getState().lines.map((l) => l.variantId)).toEqual(['p11:S/M']);
    useBag.getState().restore(removed.line, removed.index);
    expect(useBag.getState().lines.map((l) => l.variantId)).toEqual(['p03:M', 'p11:S/M']);
  });
});

describe('saved', () => {
  it('toggles and reports the new state', () => {
    expect(useSaved.getState().toggle('p01')).toBe(true);
    expect(useSaved.getState().toggle('p01')).toBe(false);
  });
  it('keeps one restock request per piece and size', () => {
    useSaved.getState().requestRestock({ productId: 'p12', size: 'One size' });
    useSaved.getState().requestRestock({ productId: 'p12', size: 'One size' });
    expect(useSaved.getState().restock).toHaveLength(1);
  });
});

describe('contact validation', () => {
  it('explains each problem in words', () => {
    expect(validateContact('name', ' ')).toMatch(/Add your name/);
    expect(validateContact('email', 'nope')).toMatch(/email address/);
    expect(validateContact('email', 'a@b.co')).toBe('');
    expect(validateContact('phone', '')).toBe('');
    expect(validateContact('phone', 'abc')).toMatch(/digits/);
  });
});
