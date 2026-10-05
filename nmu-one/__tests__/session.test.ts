import { providers } from '@/core/adapters/registry';
import { AdapterError } from '@/core/adapters/errors';
import { providerContext, setMockLatencyForTesting } from '@/core/adapters/runtime';
import { resetMockState } from '@/core/adapters/mock/state';
import { personas } from '@/core/fixtures/people';
import { useSession } from '@/state/session';

/**
 * The two ways into a session (demo persona, NMU SSO code) must end the same
 * way, and a refused code must leave nothing behind.
 */

beforeEach(async () => {
  resetMockState();
  setMockLatencyForTesting(0);
  await useSession.getState().signOut();
});
afterAll(() => setMockLatencyForTesting(null));

const code = { code: 'c', codeVerifier: 'v', redirectUri: 'nmuone://auth/callback' };

it('signs in with a code exactly as with a persona', async () => {
  const { session, user } = await providers.auth.signIn('parent');
  const spy = jest.spyOn(providers.auth, 'exchangeCode').mockResolvedValue({ session, user });
  await useSession.getState().signInWithCode(code);
  expect(spy).toHaveBeenCalledWith(code);
  const s = useSession.getState();
  expect(s.status).toBe('signed-in');
  expect(s.user?.id).toBe(personas.parent.id);
  expect(s.role).toBe('parent');
  expect(providerContext.get()).toEqual({ userId: personas.parent.id, role: 'parent' });
  spy.mockRestore();
});

it('leaves no session when the code is refused', async () => {
  const spy = jest
    .spyOn(providers.auth, 'exchangeCode')
    .mockRejectedValue(new AdapterError('unauthorised', 'auth'));
  await expect(useSession.getState().signInWithCode(code)).rejects.toThrow();
  const s = useSession.getState();
  expect(s.status).toBe('signed-out');
  expect(s.session).toBeNull();
  expect(s.signOutReason).toBe('error');
  expect(providerContext.get()).toEqual({ userId: null, role: null });
  spy.mockRestore();
});

it('refuses a code in demo mode, where there is no NMU SSO to issue one', async () => {
  await expect(useSession.getState().signInWithCode(code)).rejects.toMatchObject({
    kind: 'not-configured',
  });
  expect(useSession.getState().status).toBe('signed-out');
});
