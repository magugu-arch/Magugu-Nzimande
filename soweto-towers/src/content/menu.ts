/**
 * Chaf-Pozi, the restaurant on site. Dishes reflect the shisanyama served at
 * the foot of the towers; the final menu, prices and opening times are to be
 * confirmed with Chaf-Pozi (CONFIRM in README) and are deliberately not shown.
 */

export type MenuSection = { section: string; items: { name: string; description: string }[] };

export const menu: MenuSection[] = [
  {
    section: 'From the braai',
    items: [
      { name: 'Boerewors', description: 'Coiled farm-style sausage, flame-grilled over the coals.' },
      { name: 'Braaied chicken', description: 'Chicken pieces grilled slow over the fire until the skin crackles.' },
      { name: 'Shisanyama platter', description: 'Boerewors and braaied chicken with the sides below, built for sharing.' },
    ],
  },
  {
    section: 'On the side',
    items: [
      { name: 'Pap', description: 'Soft white maize meal, the shisanyama staple.' },
      { name: 'Chakalaka', description: 'Spiced vegetable relish with a gentle kick.' },
      { name: 'Grilled mielies', description: 'Corn on the cob, charred on the grill.' },
      { name: 'Tomato & onion relish', description: 'Fresh, sharp and made for pap.' },
      { name: 'Fresh bread rolls', description: 'Soft rolls for mopping up everything else.' },
    ],
  },
  {
    section: 'To drink',
    items: [{ name: 'Cold drinks', description: 'Ice-cold drinks from the bar, best enjoyed after your jump.' }],
  },
];
