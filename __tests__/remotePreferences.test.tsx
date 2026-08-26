import { act, renderHook, waitFor } from '@testing-library/react-native';
import { updateRemotePreferences } from '@/services/accountService';
import { useRemotePreferences } from '@/features/account/useRemotePreferences';
import { useAuthStore } from '@/store/authStore';

jest.mock('@/services/accountService', () => ({
  updateRemotePreferences: jest.fn(),
}));

const sendPreferences = updateRemotePreferences as jest.MockedFunction<
  typeof updateRemotePreferences
>;

/**
 * Every switch on the preferences screen wrote to AsyncStorage and stopped
 * there. A customer switching off "Promotions" changed a local boolean and the
 * promotions kept arriving, because nobody had been told. `marketingConsent`
 * is the one with teeth: captured at registration and sent, and from then on
 * the app offered a switch that reached nobody. Under POPIA a withdrawal of
 * consent to direct marketing has to be actionable.
 */
describe('preferences that a server has to hear about', () => {
  beforeEach(() => {
    sendPreferences.mockReset();
    sendPreferences.mockResolvedValue(undefined);
    act(() => {
      useAuthStore.setState({
        notificationPreferences: {
          orderUpdates: true,
          promotions: true,
          rewards: true,
          newProducts: false,
          channelPush: true,
          channelEmail: true,
          channelSms: false,
        },
        preferences: {
          defaultFulfilment: 'delivery',
          marketingConsent: true,
          preferMildFirst: false,
        },
      });
    });
  });

  it('tells the server when somebody switches promotions off', async () => {
    const { result } = renderHook(() => useRemotePreferences());

    act(() => result.current.setNotification('promotions', false));

    await waitFor(() => expect(sendPreferences).toHaveBeenCalledTimes(1));
    expect(sendPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        notifications: expect.objectContaining({ promotions: false }),
      }),
    );
  });

  it('sends the new value, not the one the store held a moment ago', async () => {
    const { result } = renderHook(() => useRemotePreferences());

    act(() => result.current.setMarketingConsent(false));

    await waitFor(() => expect(sendPreferences).toHaveBeenCalledTimes(1));
    expect(sendPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ marketingConsent: false }),
    );
  });

  it('moves the switch straight away, without waiting for the server', () => {
    const { result } = renderHook(() => useRemotePreferences());

    act(() => result.current.setNotification('promotions', false));

    expect(useAuthStore.getState().notificationPreferences.promotions).toBe(false);
  });

  /**
   * The one that matters. Leaving a switch off after a failed request tells
   * somebody they have opted out when they have not — worse than the switch
   * refusing to move.
   */
  it('puts the switch back when the server could not be told', async () => {
    sendPreferences.mockRejectedValueOnce(new Error('Network request failed.'));
    const { result } = renderHook(() => useRemotePreferences());

    act(() => result.current.setNotification('promotions', false));

    await waitFor(() =>
      expect(useAuthStore.getState().notificationPreferences.promotions).toBe(true),
    );
    expect(result.current.error).toMatch(/not changed/i);
  });

  it('puts marketing consent back too, and says so', async () => {
    sendPreferences.mockRejectedValueOnce(new Error('Network request failed.'));
    const { result } = renderHook(() => useRemotePreferences());

    act(() => result.current.setMarketingConsent(false));

    await waitFor(() => expect(useAuthStore.getState().preferences.marketingConsent).toBe(true));
    expect(result.current.error).not.toBeNull();
  });

  it('clears the message once it has been read', async () => {
    sendPreferences.mockRejectedValueOnce(new Error('Network request failed.'));
    const { result } = renderHook(() => useRemotePreferences());

    act(() => result.current.setNotification('promotions', false));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    act(() => result.current.dismissError());
    expect(result.current.error).toBeNull();
  });
});
