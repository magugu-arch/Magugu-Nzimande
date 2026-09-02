import type { Category, Faq, OptionGroup, Product, Sauce } from '@bbq/types';

export const CATEGORIES: readonly Category[] = [
  {
    key: 'Chicken',
    label: 'Chicken',
    note: 'Whole birds and half birds. Every order is tossed after frying, so sauce is chosen at ordering.',
  },
  {
    key: 'Wings',
    label: 'Wings and boneless',
    note: 'Wings and boneless pieces. Sauces on the side unless you ask for them tossed.',
  },
  {
    key: 'Meals',
    label: 'Meals',
    note: 'One person, one tray. Chicken with a starch, a side and a drink.',
  },
  {
    key: 'Sides',
    label: 'Sides',
    note: 'Fries, rice cakes and everything that goes in the middle of the table.',
  },
];

/** The sauce range, which also supplies the heat ladder on the home page. */
export const SAUCES: readonly Sauce[] = [
  { name: 'Golden Original', heat: 1, note: 'No sauce' },
  { name: 'Honey Garlic', heat: 2, note: 'Sweet' },
  { name: 'Soy Garlic', heat: 2, note: 'Savoury' },
  { name: 'Secret Sauce', heat: 4, note: 'Sweet heat' },
  { name: 'Hot Spicy', heat: 5, note: 'Hot' },
  { name: 'Cheesling', heat: 1, note: 'Cheese dust' },
  { name: 'Gangnam Mayo', heat: 2, note: 'Creamy' },
  { name: 'Sweet Chilli', heat: 3, note: 'Sweet heat' },
];

const EXTRAS: OptionGroup = {
  key: 'extras',
  label: 'Add to it',
  multi: true,
  defaultIndex: 0,
  choices: [
    { label: 'Extra dipping sauce', deltaCents: 1_500 },
    { label: 'Pickled radish', deltaCents: 1_500 },
    { label: 'Cheese dust', deltaCents: 2_000 },
  ],
};

/**
 * Options are derived from the category, so adding a product needs no new
 * option wiring. Half and Half is the one product with a rule of its own: it
 * carries two sauce groups, and the interface refuses the same sauce twice.
 */
export function optionGroupsFor(product: Product): OptionGroup[] {
  const groups: OptionGroup[] = [];
  const sauceChoices = SAUCES.map((sauce) => ({ label: sauce.name, deltaCents: 0 }));

  if (product.category === 'Chicken') {
    groups.push({
      key: 'size',
      label: 'Size',
      multi: false,
      defaultIndex: 0,
      choices: [
        { label: 'Whole bird', deltaCents: 0 },
        { label: 'Half bird', deltaCents: -7_000 },
      ],
    });
    if (product.slug === 'half-half') {
      groups.push({
        key: 'sauceA',
        label: 'First sauce',
        multi: false,
        defaultIndex: 0,
        choices: sauceChoices,
      });
      groups.push({
        key: 'sauceB',
        label: 'Second sauce',
        multi: false,
        defaultIndex: 1,
        choices: sauceChoices,
      });
    }
  }

  if (product.category === 'Wings') {
    groups.push({
      key: 'portion',
      label: 'Portion',
      multi: false,
      defaultIndex: 0,
      choices: [
        { label: '12 pieces', deltaCents: 0 },
        { label: '20 pieces', deltaCents: 9_000 },
      ],
    });
    groups.push({
      key: 'sauce',
      label: 'Sauce',
      multi: false,
      defaultIndex: 0,
      choices: [
        { label: 'On the side', deltaCents: 0 },
        { label: 'Tossed to order', deltaCents: 0 },
      ],
    });
  }

  if (product.category === 'Meals') {
    groups.push({
      key: 'drink',
      label: 'Drink',
      multi: false,
      defaultIndex: 0,
      choices: [
        { label: 'Cola', deltaCents: 0 },
        { label: 'Lemonade', deltaCents: 0 },
        { label: 'Still water', deltaCents: 0 },
      ],
    });
  }

  if (product.category === 'Sides') {
    groups.push({
      key: 'size',
      label: 'Size',
      multi: false,
      defaultIndex: 0,
      choices: [
        { label: 'Regular', deltaCents: 0 },
        { label: 'Large', deltaCents: 2_000 },
      ],
    });
  }

  groups.push(EXTRAS);
  return groups;
}

/** The two sauce groups on Half and Half, which may never hold the same sauce. */
export const EXCLUSIVE_SAUCE_GROUPS = ['sauceA', 'sauceB'] as const;

export const FAQS: readonly Faq[] = [
  {
    question: 'How long does delivery take?',
    answer:
      'Between 35 and 45 minutes in most suburbs, measured from the moment payment clears. The timer on My journey updates as the order moves through the kitchen, so it is the number to trust rather than the estimate at checkout.',
  },
  {
    question: 'Why is the chicken fried twice?',
    answer:
      'The first fry cooks the bird through. The second drives the moisture out of the crust. It is what keeps the coating crisp under sauce, and it is why an order takes a few minutes longer than a single-fry kitchen.',
  },
  {
    question: 'When is the sauce added?',
    answer:
      'After frying, to order. Nothing sits pre-sauced, which is why you choose the flavour when you order rather than picking from a warmer.',
  },
  {
    question: 'Can I order two flavours on one bird?',
    answer:
      'Yes. Half and Half lets you choose any two sauces on a single bird. Pick them in the product screen before adding to your basket.',
  },
  {
    question: 'What if my suburb is not covered?',
    answer:
      'Collection is available at both stores and takes about 20 minutes. Delivery areas widen as the estate grows, so a suburb outside the zone today may be inside it later.',
  },
  {
    question: 'How do points work?',
    answer:
      'One point for every rand spent, on every fulfilment mode. Points post once the order is completed, and can be spent on any reward you have reached.',
  },
  {
    question: 'Can I change an order after placing it?',
    answer:
      'Call the store directly. Once an order reaches Preparing the kitchen has already started, so changes are limited to additions.',
  },
  {
    question: 'Is the chicken halaal?',
    answer:
      'Certification is confirmed per store and displayed in store. Ask the store before ordering if this matters to your order.',
  },
  {
    question: 'Do you cater for large tables?',
    answer:
      'Half and Half was built for it, and the sauced wings come in whole-wing portions meant to be shared. For a table of eight or more, call the store the day before so the kitchen can stage the order rather than cook it all at once.',
  },
  {
    question: 'Which items are vegetarian?',
    answer:
      'Ddeok-Bokki, Rose Ddeok-Bokki, Cheese Ddeok-Bokki, French Fries and Sweet Potato Fries carry no chicken. They are cooked in a shared kitchen, so tell the store if this is an allergy rather than a preference.',
  },
  {
    question: 'What is the difference between wings and boneless?',
    answer:
      'Wings are whole wings on the bone. Boneless is breast meat in the same crumb, cut into pieces. Both take any sauce, and boneless is the easier one to eat while walking.',
  },
  {
    question: 'Why do some items show the same photograph?',
    answer:
      'Sixteen product photographs were supplied and the menu has grown past them. Items added since carry the closest supplied image rather than an invented one, and each is waiting on its own shoot.',
  },
];

/** The craft line is fixed copy. It is never paraphrased. */
export const CRAFT_LINE = 'Twice fried in olive oil. Tossed to order.';
