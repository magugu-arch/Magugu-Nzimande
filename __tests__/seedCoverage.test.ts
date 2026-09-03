import { fetchRewards } from '@/services/rewardsService';
import { fetchStoresForFulfilment } from '@/services/storeService';
import { rewards } from '@/services/data/rewardsData';
import { stores } from '@/services/data/storeData';
import { demoUser } from '@/services/data/accountData';
import { rewardExpired } from '@/services/rewardsService';
import { supportsFulfilment } from '@/utils/fulfilment';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import { act } from '@testing-library/react-native';

/**
 * States the app can render, against a seed that had no example of them.
 *
 * Each of these guards a branch that was written, tested in isolation, and
 * never once reached with real data — the pattern that has produced every
 * defect found in this codebase by fixture rather than by test.
 */

describe('a branch that takes collection and nothing else', () => {
  const collectionOnly = stores.find((store) => store.id === 'store-canalwalk')!;

  it('is seeded, and is the only one', () => {
    expect(collectionOnly.supportsDelivery).toBe(false);
    expect(collectionOnly.supportsCollection).toBe(true);

    // Until this fixture, `supportsDelivery` and `supportsCollection` were
    // true on all seven, so half of `supportsFulfilment` had never excluded
    // anything.
    const noDelivery = stores.filter((store) => !store.supportsDelivery);
    expect(noDelivery.map((store) => store.id)).toEqual(['store-canalwalk']);
  });

  it('is offered for collection and withheld for delivery', async () => {
    const forCollection = await fetchStoresForFulfilment('collection');
    const forDelivery = await fetchStoresForFulfilment('delivery');

    expect(forCollection.map((store) => store.id)).toContain('store-canalwalk');
    expect(forDelivery.map((store) => store.id)).not.toContain('store-canalwalk');
  });

  /**
   * The transition that had never run. A customer picks this branch to
   * collect, changes their mind and switches to delivery — the branch cannot
   * do it, so it must not silently stay selected.
   */
  it('is dropped when the customer switches to delivery', () => {
    act(() => {
      useFulfilmentStore.getState().setFulfilmentType('collection');
      useFulfilmentStore.getState().setStore(collectionOnly);
    });
    expect(useFulfilmentStore.getState().store?.id).toBe('store-canalwalk');

    act(() => {
      useFulfilmentStore.getState().setFulfilmentType('delivery');
    });
    expect(useFulfilmentStore.getState().store).toBeNull();
  });

  it('survives a switch to something it can do', () => {
    const both = stores.find((store) => store.supportsDelivery && store.supportsCollection)!;
    act(() => {
      useFulfilmentStore.getState().setFulfilmentType('collection');
      useFulfilmentStore.getState().setStore(both);
      useFulfilmentStore.getState().setFulfilmentType('delivery');
    });
    expect(useFulfilmentStore.getState().store?.id).toBe(both.id);
  });

  it('agrees with the single gate the rest of the app asks', () => {
    expect(supportsFulfilment(collectionOnly, 'delivery')).toBe(false);
    expect(supportsFulfilment(collectionOnly, 'collection')).toBe(true);
    expect(supportsFulfilment(collectionOnly, 'dinein')).toBe(false);
  });
});

describe('a reward with a date on it', () => {
  it('seeds one that is live and one that has run out', () => {
    const dated = rewards.filter((reward) => reward.expiresAt);
    expect(dated.length).toBeGreaterThanOrEqual(2);

    const lapsed = rewards.filter((reward) => rewardExpired(reward));
    expect(lapsed.map((reward) => reward.id)).toEqual(['reward-heritage']);
  });

  /**
   * The assertion the fixture exists for: the date overrules the record.
   *
   * `reward-heritage` is seeded `redeemable: true` on purpose. Both the mock
   * path and the remote path derive redeemability rather than trusting the
   * flag, and this is the only case where the two disagree — a fixture that
   * agreed with itself would prove nothing.
   */
  it('cannot be redeemed once it has lapsed, whatever the record claims', async () => {
    const seeded = rewards.find((reward) => reward.id === 'reward-heritage')!;
    expect(seeded.redeemable).toBe(true);

    const served = await fetchRewards();
    const heritage = served.find((reward) => reward.id === 'reward-heritage')!;
    expect(heritage.redeemable).toBe(false);
  });

  it('leaves a live dated reward alone', async () => {
    const served = await fetchRewards();
    const r50 = served.find((reward) => reward.id === 'reward-r50')!;
    expect(rewardExpired(r50)).toBe(false);
    // Still subject to the balance rule, which is a different question.
    expect(r50.expiresAt).toBeDefined();
  });

  it('still lists a lapsed reward rather than hiding it', async () => {
    // A member who earned toward something deserves to be told it closed,
    // not to watch it vanish.
    const served = await fetchRewards();
    expect(served.map((reward) => reward.id)).toContain('reward-heritage');
  });
});

describe('an account that never clicked the email link', () => {
  it('is what the seed now describes', () => {
    // The signup flow walks a customer through an OTP screen, so the number is
    // confirmed. The email link arrives later and most people never click it.
    expect(demoUser.phoneVerified).toBe(true);
    expect(demoUser.emailVerified).toBe(false);
  });
});
