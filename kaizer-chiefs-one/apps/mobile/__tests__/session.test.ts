import { auth } from '@/data/auth';
import { isExpired, useSession } from '@/state/session';

jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001' }));

describe('session', () => {
  it('detects expiry', () => {
    const s = {
      userId: 'u',
      displayName: 'A',
      email: 'a@b.co',
      isDemo: true,
      issuedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-01T01:00:00Z',
    };
    expect(isExpired(s, new Date('2026-01-01T00:59:00Z'))).toBe(false);
    expect(isExpired(s, new Date('2026-01-01T01:00:00Z'))).toBe(true);
  });

  it('records why a session ended', () => {
    useSession.getState().setSession({
      userId: 'u',
      displayName: 'A',
      email: 'a@b.co',
      isDemo: true,
      issuedAt: '',
      expiresAt: '',
    });
    useSession.getState().signOut('expired');
    expect(useSession.getState().session).toBeNull();
    expect(useSession.getState().expiredNotice).toBe(true);
  });

  it('demo sign-in applies the real validation rules and never creates an account', async () => {
    expect((await auth.signIn('not-an-email', 'x')).status).toBe('unavailable');
    const r = await auth.signIn('fan@example.com', 'anything');
    expect(r.status === 'ok' && r.data.isDemo).toBe(true);
    const reset = await auth.requestPasswordReset('fan@example.com');
    expect(reset).toMatchObject({ status: 'unavailable', reason: 'demo_restricted' });
  });
});
