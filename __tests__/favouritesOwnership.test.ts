import type { AuthSession, UserProfile } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useFavouritesStore } from '@/store/favouritesStore';

const person = (id: string, isGuest = false): UserProfile => ({
  id,
  firstName: 'Thabo',
  lastName: 'Nkosi',
  email: `${id}@example.co.za`,
  phone: '+27821234567',
  avatarInitials: 'TN',
  isGuest,
  emailVerified: true,
  phoneVerified: true,
  createdAt: new Date().toISOString(),
});

const sessionFor = (user: UserProfile): AuthSession =>
  ({ user, accessToken: 'a', refreshToken: 'r' }) as AuthSession;

/**
 * Favourites are local and outlive a sign-out on purpose: signing out to browse
 * should not take them away, and `useSignOut` leaves them standing for exactly
 * that reason.
 *
 * Nothing asked whose they were, though. So the next person to sign in on the
 * same handset inherited a stranger's hearted dishes — presented to them as
 * their own, under a Favourites tab built to show them.
 */
describe('who a list of favourites belongs to', () => {
  beforeEach(() => {
    useFavouritesStore.setState({ productIds: [], ownerId: null });
  });

  it('keeps them for the person who hearted them, signing back in', () => {
    useAuthStore.getState().setSession(sessionFor(person('user-1')));
    useFavouritesStore.getState().toggle('golden-original');

    // Out and back in again — the same person, the same phone.
    useAuthStore.getState().setSession(sessionFor(person('user-1')));

    expect(useFavouritesStore.getState().productIds).toEqual(['golden-original']);
  });

  it('does not hand them to somebody else', () => {
    useAuthStore.getState().setSession(sessionFor(person('user-1')));
    useFavouritesStore.getState().toggle('golden-original');
    useFavouritesStore.getState().toggle('honey-garlic');

    useAuthStore.getState().setSession(sessionFor(person('user-2')));

    expect(useFavouritesStore.getState().productIds).toEqual([]);
    expect(useFavouritesStore.getState().ownerId).toBe('user-2');
  });

  /**
   * The case the store was written to protect, and the reason this is a
   * question of ownership rather than a clear on sign-out: somebody signed out
   * for a moment is very often the same person.
   */
  it('leaves a guest browse alone', () => {
    useAuthStore.getState().setSession(sessionFor(person('user-1')));
    useFavouritesStore.getState().toggle('golden-original');

    useAuthStore.getState().setSession(sessionFor(person('guest-abc', true)));

    expect(useFavouritesStore.getState().productIds).toEqual(['golden-original']);
    // Still theirs, so signing back in does not clear them either.
    expect(useFavouritesStore.getState().ownerId).toBe('user-1');
  });

  it('lets a first signed-in person keep what they hearted while signed out', () => {
    useFavouritesStore.getState().toggle('soy-garlic');

    useAuthStore.getState().setSession(sessionFor(person('user-1')));

    expect(useFavouritesStore.getState().productIds).toEqual(['soy-garlic']);
  });
});
