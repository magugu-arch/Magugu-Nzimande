import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  forgetPushTokenInMemory,
  revokePushToken,
  syncPushToken,
  syncedPushToken,
} from '@/services/notificationService';

/**
 * Which handset gets whose order updates.
 *
 * Signing out calls `DELETE /v1/account/push-tokens/:token` so the server stops
 * pushing this person's order status — reference and all — to a phone that has
 * been shared, handed down or sold. It needs the token to do that, and the
 * token used to live only in module state.
 *
 * That made the unbinding a no-op in exactly the cases it exists for, because
 * sign-out routinely happens in a different session from the sync. The worst
 * one: `usePushRegistration` returns before syncing when "Push notifications"
 * is off, so a customer who turned them off after registering never
 * repopulated the token on any later launch — and their sign-out reported
 * success and sent nothing, for ever.
 */
beforeEach(async () => {
  forgetPushTokenInMemory();
  await AsyncStorage.clear();
});

describe('the push token survives the session that created it', () => {
  it('is remembered after a sync', async () => {
    await syncPushToken('ExponentPushToken[abc123]');
    await expect(syncedPushToken()).resolves.toBe('ExponentPushToken[abc123]');
  });

  it('is still there after a relaunch', async () => {
    await syncPushToken('ExponentPushToken[abc123]');

    // What a cold start looks like from this module's side: the process is new
    // and module state is empty, but the handset is still bound on the server.
    forgetPushTokenInMemory();

    await expect(syncedPushToken()).resolves.toBe('ExponentPushToken[abc123]');
  });

  it('is what a sign-out in a later session unbinds', async () => {
    await syncPushToken('ExponentPushToken[abc123]');
    forgetPushTokenInMemory();

    /**
     * The assertion that does the work.
     *
     * `revokePushToken` resolves `true` whether it sent a DELETE or found
     * nothing to send one for — it returns early on both — so asserting the
     * return value proves nothing about the unbinding. What matters is that
     * there is a token here to unbind at the moment sign-out asks, which is
     * exactly what a relaunched process used to have lost.
     */
    await expect(syncedPushToken()).resolves.toBe('ExponentPushToken[abc123]');

    await expect(revokePushToken()).resolves.toBe(true);
    // Gone from both, so nothing tries to unbind it from the next account.
    await expect(syncedPushToken()).resolves.toBeNull();
  });

  it('has nothing to unbind when nothing was ever bound', async () => {
    await expect(revokePushToken()).resolves.toBe(true);
    await expect(syncedPushToken()).resolves.toBeNull();
  });

  it('does not carry one account’s token into the next sign-in', async () => {
    await syncPushToken('ExponentPushToken[first]');
    await revokePushToken();

    // A second person signs in on the same handset and never enables push.
    forgetPushTokenInMemory();
    await expect(syncedPushToken()).resolves.toBeNull();
  });

  it('replaces the token rather than accumulating them', async () => {
    await syncPushToken('ExponentPushToken[old]');
    await syncPushToken('ExponentPushToken[new]');
    forgetPushTokenInMemory();
    await expect(syncedPushToken()).resolves.toBe('ExponentPushToken[new]');
  });
});
