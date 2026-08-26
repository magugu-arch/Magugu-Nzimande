import { act } from '@testing-library/react-native';
import type { AuthSession, UserProfile } from '@/types';
import { register, signIn } from '@/services/authService';
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

/**
 * The first sign-out a customer ever does.
 *
 * `signIn` derives a user id from the email address, so signing in twice as the
 * same person is the same person. `register` minted `user-${Date.now()}`, so
 * registering and later signing back in produced two different people from one
 * address — and `claimFor` clears the list when the owner changes, which is
 * right and is what stops one person inheriting another's.
 *
 *     registered as   user-1787754650382
 *     signed in as    user-thandi-example-co-za
 *     favourites      3 before, 0 after
 *
 * `audit:handover` exists to hold exactly this line and could not see it: it
 * signs in rather than registering, as does every other journey in the repo.
 */
describe('somebody who registered, rather than signed in', () => {
  const account = {
    firstName: 'Thandi',
    lastName: 'Mokoena',
    email: 'thandi@example.co.za',
    phone: '0821234567',
    password: 'chickenchicken1',
    marketingConsent: false,
  };

  beforeEach(() => {
    act(() => {
      useFavouritesStore.setState({ productIds: [], ownerId: null });
    });
  });

  it('is the same person when they sign back in', async () => {
    const registered = await register(account);
    const returned = await signIn({ email: account.email, password: account.password });
    expect(returned.user.id).toBe(registered.user.id);
  });

  it('keeps the dishes they hearted before their first sign-out', async () => {
    const registered = await register(account);

    act(() => {
      useFavouritesStore.getState().claimFor(registered.user.id);
      useFavouritesStore.setState({
        productIds: ['golden-original', 'chicken-burger', 'french-fries'],
      });
    });

    const returned = await signIn({ email: account.email, password: account.password });
    act(() => {
      useFavouritesStore.getState().claimFor(returned.user.id);
    });

    expect(useFavouritesStore.getState().productIds).toHaveLength(3);
  });

  it('still hands nothing to somebody else who signs in on that handset', async () => {
    // The other half of the rule, which must not be traded away for the first.
    const registered = await register(account);
    act(() => {
      useFavouritesStore.getState().claimFor(registered.user.id);
      useFavouritesStore.setState({ productIds: ['golden-original'] });
    });

    const someoneElse = await signIn({ email: 'sipho@example.co.za', password: 'chickenchicken1' });
    act(() => {
      useFavouritesStore.getState().claimFor(someoneElse.user.id);
    });

    expect(useFavouritesStore.getState().productIds).toEqual([]);
  });

  it('treats the address case-insensitively, the way an email is', async () => {
    const registered = await register({ ...account, email: 'Thandi@Example.co.za' });
    const returned = await signIn({ email: 'thandi@example.co.za', password: account.password });
    expect(returned.user.id).toBe(registered.user.id);
  });
});
