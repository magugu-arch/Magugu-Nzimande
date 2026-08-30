import {
  mergeFavourites,
  pullFavourites,
  startFavouritesSync,
  stopFavouritesSync,
} from '@/features/favourites/sync';
import { useFavouritesStore } from '@/store/favouritesStore';

const mockFetch = jest.fn<Promise<string[]>, [string]>();
const mockSave = jest.fn<Promise<string[]>, [string, string[]]>();

jest.mock('@/services/accountService', () => ({
  fetchFavourites: (customerId: string) => mockFetch(customerId),
  saveFavourites: (customerId: string, ids: string[]) => mockSave(customerId, ids),
}));

/**
 * Carrying hearted products between the handset and the account.
 *
 * The merge is the part with consequences. Favourites are the one thing in the
 * app that legitimately exists in two places at once — a guest hearts three
 * dishes on this handset while the account already holds two from another — and
 * every obvious merge rule loses somebody's taps:
 *
 *   server wins  → the guest's three vanish the moment they sign in, which is
 *                  the exact failure `favouritesStore` was written to avoid
 *   local wins   → a fresh handset silently erases the account's list
 *
 * Union is the only rule that cannot lose a heart somebody deliberately gave,
 * and these hold it to that.
 */
beforeEach(() => {
  mockFetch.mockReset();
  mockSave.mockReset();
  mockSave.mockResolvedValue([]);
  useFavouritesStore.setState({ productIds: [], ownerId: null });
});

afterEach(() => stopFavouritesSync());

describe('merging a handset list with an account list', () => {
  it('keeps everything from both sides', () => {
    expect(mergeFavourites(['a', 'b'], ['c'])).toEqual(['a', 'b', 'c']);
  });

  it('never duplicates what both already had', () => {
    expect(mergeFavourites(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('keeps local order first, because that is most-recent-first', () => {
    // The Favourites tab reads as a history of what they liked. Anything only
    // the account knew about is older by definition, so it goes after.
    expect(mergeFavourites(['newest', 'older'], ['oldest'])).toEqual(['newest', 'older', 'oldest']);
  });

  it('takes the whole account list onto an empty handset', () => {
    expect(mergeFavourites([], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('leaves a handset list alone when the account has nothing', () => {
    expect(mergeFavourites(['a'], [])).toEqual(['a']);
  });
});

describe('pulling on sign-in', () => {
  it("adds the account's hearts to the ones given as a guest", async () => {
    useFavouritesStore.setState({ productIds: ['hot-spicy'], ownerId: 'user-1' });
    mockFetch.mockResolvedValue(['honey-garlic']);

    await pullFavourites('user-1');

    expect(useFavouritesStore.getState().productIds).toEqual(['hot-spicy', 'honey-garlic']);
  });

  it('pushes the merged list back, so both devices agree', async () => {
    useFavouritesStore.setState({ productIds: ['hot-spicy'], ownerId: 'user-1' });
    mockFetch.mockResolvedValue(['honey-garlic']);

    await pullFavourites('user-1');

    expect(mockSave).toHaveBeenCalledWith('user-1', ['hot-spicy', 'honey-garlic']);
  });

  it('does not touch the store when the account agrees with the handset', async () => {
    useFavouritesStore.setState({ productIds: ['hot-spicy'], ownerId: 'user-1' });
    const before = useFavouritesStore.getState().productIds;
    mockFetch.mockResolvedValue(['hot-spicy']);

    await pullFavourites('user-1');

    // Same array identity — every hearted row would otherwise re-render for a
    // pull that changed nothing.
    expect(useFavouritesStore.getState().productIds).toBe(before);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('leaves the handset list intact when the account cannot be reached', async () => {
    useFavouritesStore.setState({ productIds: ['hot-spicy'], ownerId: 'user-1' });
    mockFetch.mockRejectedValue(new Error('offline'));

    // A failed pull must not reject either — sign-in does not await it, so an
    // unhandled rejection is all it would produce.
    await expect(pullFavourites('user-1')).resolves.toBeUndefined();
    expect(useFavouritesStore.getState().productIds).toEqual(['hot-spicy']);
  });
});

describe('pushing as hearts change', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
  });
  afterEach(() => jest.useRealTimers());

  it('sends the list after the tapping stops', () => {
    useFavouritesStore.setState({ ownerId: 'user-1' });
    startFavouritesSync();

    useFavouritesStore.getState().toggle('hot-spicy');
    expect(mockSave).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(mockSave).toHaveBeenCalledWith('user-1', ['hot-spicy']);
  });

  it('sends once for a burst, not once per tap', () => {
    useFavouritesStore.setState({ ownerId: 'user-1' });
    startFavouritesSync();

    useFavouritesStore.getState().toggle('hot-spicy');
    useFavouritesStore.getState().toggle('honey-garlic');
    useFavouritesStore.getState().toggle('boneless');
    jest.advanceTimersByTime(1000);

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith('user-1', ['boneless', 'honey-garlic', 'hot-spicy']);
  });

  it('stays quiet while nobody is signed in', () => {
    // A guest has no account to put a list on. Their hearts still persist
    // locally; they are merged up at sign-in by the pull above.
    useFavouritesStore.setState({ ownerId: null });
    startFavouritesSync();

    useFavouritesStore.getState().toggle('hot-spicy');
    jest.advanceTimersByTime(1000);

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('stops when torn down, so a pending push cannot outlive it', () => {
    useFavouritesStore.setState({ ownerId: 'user-1' });
    startFavouritesSync();

    useFavouritesStore.getState().toggle('hot-spicy');
    stopFavouritesSync();
    jest.advanceTimersByTime(1000);

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('does not stack subscriptions when started twice', () => {
    useFavouritesStore.setState({ ownerId: 'user-1' });
    startFavouritesSync();
    startFavouritesSync();

    useFavouritesStore.getState().toggle('hot-spicy');
    jest.advanceTimersByTime(1000);

    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});

/**
 * One phone, two people — the journey `audit:handover` drives.
 *
 * These exist because the first version of this sync failed it. The mock
 * behind `fetchFavourites` was a single global array, so signing in as a
 * second person pulled the first person's hearted dishes onto their account,
 * under a Favourites tab that presents them as their own. That is the exact
 * defect `favouritesStore.claimFor` was written to prevent, reintroduced
 * through the back door of a mock that modelled the endpoint wrongly.
 *
 * A unit test cannot catch a wrong mock, so these hold the client half: the
 * account is named on every call, and a reply that arrives for the wrong one
 * is dropped.
 */
describe('whose favourites these are', () => {
  it('asks for the named account, not "the" favourites', async () => {
    useFavouritesStore.setState({ productIds: [], ownerId: 'user-thandi' });
    mockFetch.mockResolvedValue([]);

    await pullFavourites('user-thandi');

    expect(mockFetch).toHaveBeenCalledWith('user-thandi');
  });

  it('drops a reply that arrives after somebody else has signed in', async () => {
    useFavouritesStore.setState({ productIds: ['hot-spicy'], ownerId: 'user-thandi' });

    // The request is in flight when the handset changes hands.
    mockFetch.mockImplementation(async () => {
      useFavouritesStore.setState({ productIds: [], ownerId: 'user-sipho' });
      return ['honey-garlic', 'cheesling-fries'];
    });

    await pullFavourites('user-thandi');

    // Sipho gets nothing of Thandi's, and nothing is pushed to his account.
    expect(useFavouritesStore.getState().productIds).toEqual([]);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('pushes to the account that owns the list, not whoever is signed in later', () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    try {
      useFavouritesStore.setState({ ownerId: 'user-thandi' });
      startFavouritesSync();

      useFavouritesStore.getState().toggle('hot-spicy');
      // Signing out inside the debounce window must not send the list anywhere.
      useFavouritesStore.setState({ ownerId: null });
      jest.advanceTimersByTime(1000);

      expect(mockSave).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
