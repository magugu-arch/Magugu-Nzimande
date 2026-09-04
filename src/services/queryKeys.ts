/** Single source of truth for TanStack Query cache keys. */
export const queryKeys = {
  menu: ['menu'] as const,
  categories: ['menu', 'categories'] as const,
  category: (categoryId: string) => ['menu', 'category', categoryId] as const,
  product: (productId: string) => ['menu', 'product', productId] as const,
  products: (ids: string[]) => ['menu', 'products', ...ids] as const,
  bestSellers: ['menu', 'bestSellers'] as const,
  popular: ['menu', 'popular'] as const,
  newProducts: ['menu', 'new'] as const,
  search: (query: string) => ['menu', 'search', query] as const,

  stores: (lat: number, lng: number) => ['stores', lat, lng] as const,
  /**
   * The store list with no origin — nobody knows where the customer is.
   *
   * Its own key rather than `stores(0, 0)`: that list carries no distances and
   * is sorted alphabetically, so it must not be served to a caller who has
   * since been given coordinates, nor overwrite one that was.
   */
  storesAnywhere: () => ['stores', 'anywhere'] as const,

  /**
   * A courier's serviceability quote. Keyed by everything it depends on, so a
   * reply for an address the customer has since changed is never read as an
   * answer about the new one.
   */
  courierQuote: (
    storeId: string | undefined,
    latitude: number | undefined,
    longitude: number | undefined,
    orderValue: number,
  ) => ['courier', 'quote', storeId ?? '', latitude ?? '', longitude ?? '', orderValue] as const,
  store: (storeId: string) => ['stores', storeId] as const,

  orders: ['orders'] as const,
  order: (orderId: string) => ['orders', orderId] as const,
  activeOrder: ['orders', 'active'] as const,

  loyalty: ['loyalty'] as const,
  /**
   * Keyed by birthday month, because redeemability now depends on it.
   *
   * Without it a list cached in June would still say the birthday box is
   * locked on the first of July, and a customer who adds their date of birth
   * to their profile would see no change until something else invalidated the
   * query. The month, not the date: the rule only reads that far, and a key
   * that carried the whole date would leak a birthday into cache diagnostics
   * for nothing.
   */
  rewards: (birthdayMonth: number | null = null) => ['loyalty', 'rewards', birthdayMonth] as const,
  reward: (rewardId: string, birthdayMonth: number | null = null) =>
    ['loyalty', 'reward', rewardId, birthdayMonth] as const,
  tiers: ['loyalty', 'tiers'] as const,
  vouchers: ['loyalty', 'vouchers'] as const,

  promotions: ['promotions'] as const,
  promotion: (promotionId: string) => ['promotions', promotionId] as const,

  addresses: ['account', 'addresses'] as const,
  paymentMethods: ['account', 'paymentMethods'] as const,
  notifications: ['account', 'notifications'] as const,
  supportTopics: ['support', 'topics'] as const,
} as const;
