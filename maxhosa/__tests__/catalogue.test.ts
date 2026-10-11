import { availabilitySummary, filterProducts } from '@/domain/catalogue';
import { MockCommerceProvider } from '@/providers/commerce/MockCommerceProvider';
import { DEFAULT_FILTERS } from '@/store/shop';

const commerce = new MockCommerceProvider();

describe('shop filtering', () => {
  it('searches name, code, category and colour, with every term required', async () => {
    const [products, categories] = await Promise.all([
      commerce.listProducts('ZA'),
      commerce.listCategories(),
    ]);
    const names = (q: string) =>
      filterProducts(products, { ...DEFAULT_FILTERS, query: q }, categories).map((p) => p.id);
    expect(names('polo')).toEqual(expect.arrayContaining(['p03', 'p04']));
    expect(names('DEMO-MX-011')).toEqual(['p11']);
    expect(names('accessories beaded').every((id) => ['p12', 'p13', 'p14'].includes(id))).toBe(
      true,
    );
    expect(names('zzzz')).toEqual([]);
  });

  it('only counts a size as available when it is not sold out', async () => {
    const [products, categories] = await Promise.all([
      commerce.listProducts('ZA'),
      commerce.listCategories(),
    ]);
    const ids = filterProducts(products, { ...DEFAULT_FILTERS, sizes: ['XXL'] }, categories).map(
      (p) => p.id,
    );
    // p01's XXL is unavailable; p03's XXL is pre-order.
    expect(ids).toContain('p03');
    expect(ids).not.toContain('p01');
  });

  it('sorts by price in integer minor units', async () => {
    const [products, categories] = await Promise.all([
      commerce.listProducts('ZA'),
      commerce.listCategories(),
    ]);
    const sorted = filterProducts(products, { ...DEFAULT_FILTERS, sort: 'price-asc' }, categories);
    const amounts = sorted.map((p) => Number(p.price.amount));
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
  });

  it('summarises stock honestly from the variants', async () => {
    const coat = (await commerce.getProduct('p06', 'ZA'))!;
    const necklace = (await commerce.getProduct('p12', 'ZA'))!;
    const polo = (await commerce.getProduct('p03', 'ZA'))!;
    expect(availabilitySummary(coat).label).toBe('Pre-order');
    expect(availabilitySummary(necklace).label).toBe('Unavailable');
    expect(availabilitySummary(polo).label).toBe('Available in some sizes');
  });
});
