import { matchProducts, normaliseForSearch } from '@/features/menu/search';
import { products } from '@/services/data/menuData';

const names = (query: string) => matchProducts(products, query).map((product) => product.name);

/**
 * Search was `haystack.includes(query)` over one joined string, so a query only
 * matched if it appeared contiguously, in order, and punctuated exactly as the
 * menu punctuates it. Against the real sixteen-item menu, seven of ten
 * plausible queries returned nothing at all.
 *
 * These run against the shipped seed rather than a fixture on purpose. The
 * failures were all collisions between how the menu is written and how people
 * type — "Ddeok-Bokki" against "ddeok bokki", "Half & Half" against "half and
 * half" — and a fixture invented here would have neither.
 */
describe('a customer typing the name of a dish', () => {
  it('finds a hyphenated dish typed with a space', () => {
    // The one that gives the game away: the dish is literally called this.
    expect(names('ddeok bokki')).toContain('Ddeok-Bokki');
  });

  it('finds an ampersand dish typed with the word and', () => {
    expect(names('half and half')).toContain('Half & Half Chicken');
    expect(names('chicken and rice')).toContain('Chicken & Rice Meal');
  });

  it('still finds it typed with the ampersand', () => {
    expect(names('half & half')).toContain('Half & Half Chicken');
  });

  it('does not mind the order the words come in', () => {
    expect(names('burger chicken')).toContain('Chicken Burger');
    expect(names('garlic honey')).toContain('Honey Garlic Chicken');
  });

  it('finds a dish by a word that is only part of its name', () => {
    // "Cheesling Fries" — nobody types "cheesling".
    expect(names('cheese fries')).toContain('Cheesling Fries');
  });

  it('narrows as more words are typed', () => {
    const one = names('chicken');
    const two = names('chicken burger');
    expect(one.length).toBeGreaterThan(two.length);

    // Both burgers, and that is the right answer: Cheesling Burger's own
    // description opens "Crispy chicken burger". This asserted the single name
    // `['Chicken Burger']` while the menu happened to hold one burger — a
    // claim about the catalogue wearing the shape of a claim about search.
    // What narrowing means is that every survivor matches both words.
    expect(two).toContain('Chicken Burger');
    expect(two).toContain('Cheesling Burger');
    expect(two.every((name) => one.includes(name))).toBe(true);
  });

  it('keeps the menu order among equally good matches', () => {
    const order = products.map((product) => product.name);
    const found = names('chicken');
    expect(found).toEqual(order.filter((name) => found.includes(name)));
  });
});

/**
 * When nothing matches every word, near misses beat an apology.
 *
 * "We couldn't find anything for that" on a sixteen-item menu is nearly always
 * the search's fault rather than the kitchen's.
 */
describe('when no dish matches every word', () => {
  /**
   * The query used to be "honey garlic wings", chosen because no single dish
   * carried all three words — the menu had sauced chicken and plain wings and
   * nothing in between. The menu extension added Honey Garlic Wings, so that
   * query now has an exact answer and stopped testing the fallback at all.
   * It passed for a while as a test of the wrong thing.
   *
   * "cheesling rice bowl" is the same shape against the menu as it now stands:
   * Korean Rice Bowl carries two of the three words, the cheesling dishes
   * carry one, and nothing carries all three.
   */
  it('offers what matched some of them, most first', () => {
    const found = names('cheesling rice bowl');
    expect(found[0]).toBe('Korean Rice Bowl');
    expect(found).toContain('Cheesling Fries');
  });

  it('does not fall back so far that it offers the whole menu', () => {
    expect(names('cheesling rice bowl').length).toBeLessThan(products.length);
  });

  it('still finds nothing when there is nothing to find', () => {
    expect(names('xyzzy')).toEqual([]);
    expect(names('pizza margherita')).toEqual([]);
  });

  it('finds nothing for an empty or punctuation-only query', () => {
    expect(names('')).toEqual([]);
    expect(names('   ')).toEqual([]);
    expect(names('!!!')).toEqual([]);
  });
});

describe('normalising what was typed', () => {
  it('folds case, punctuation and accents', () => {
    expect(normaliseForSearch('Ddeok-Bokki')).toBe('ddeok bokki');
    expect(normaliseForSearch('  Rosé   Sauce! ')).toBe('rose sauce');
  });

  it('turns an ampersand into the word rather than dropping it', () => {
    // Dropping it would make "half half", and leave "half and half"
    // unmatchable — one missed spelling traded for another.
    expect(normaliseForSearch('Half & Half')).toBe('half and half');
  });
});

/**
 * The four terms the menu screen offers as one-tap shortcuts. Each is a promise
 * that tapping it shows something.
 */
describe('the suggested searches all lead somewhere', () => {
  it.each(['Honey Garlic', 'Wings', 'Boneless', 'Cheesling Fries', 'Spicy', 'Rice bowl'])(
    '%s finds at least one dish',
    (term) => {
      expect(names(term).length).toBeGreaterThan(0);
    },
  );
});
