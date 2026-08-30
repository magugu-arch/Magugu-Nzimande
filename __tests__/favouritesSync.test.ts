import {
  mergeFavourites,
  pullFavourites,
  startFavouritesSync,
  stopFavouritesSync,
} from '@/features/favourites/sync';
import { useFavouritesStore } from '@/store/favouritesStore';

const mockFetch = jest.fn<Promise<string[]>, []>();
const mockSave = jest.fn<Promise<string[]>, [string[]]>();

jest.mock('@/services/accountService', () => ({
  fetchFavourites: () => mockFetch(),
  saveFavourites: (ids: string[]) => mockSave(ids),
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

    await pullFavourites();

    expect(useFavouritesStore.getState().productIds).toEqual(['hot-spicy', 'honey-garlic']);
  });

  it('pushes the merged list back, so both devices agree', async () => {
    useFavouritesStore.setState({ productIds: ['hot-spicy'], ownerId: 'user-1' });
    mockFetch.mockResolvedValue(['honey-garlic']);

    await pullFavourites();

    expect(mockSave).toHaveBeenCalledWith(['hot-spicy', 'honey-garlic']);
  });

  it('does not touch the store when the account agrees with the handset', async () => {
    useFavouritesStore.setState({ productIds: ['hot-spicy'], ownerId: 'user-1' });
    const before = useFavouritesStore.getState().productIds;
    mockFetch.mockResolvedValue(['hot-spicy']);

    await pullFavourites();

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
    await expect(pullFavourites()).resolves.toBeUndefined();
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
    expect(mockSave).toHaveBeenCalledWith(['hot-spicy']);
  });

  it('sends once for a burst, not once per tap', () => {
    useFavouritesStore.setState({ ownerId: 'user-1' });
    startFavouritesSync();

    useFavouritesStore.getState().toggle('hot-spicy');
    useFavouritesStore.getState().toggle('honey-garlic');
    useFavouritesStore.getState().toggle('boneless');
    jest.advanceTimersByTime(1000);

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(['boneless', 'honey-garlic', 'hot-spicy']);
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
