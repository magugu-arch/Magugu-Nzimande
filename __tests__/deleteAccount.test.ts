import { config } from '@/constants/config';
import { deleteAccount } from '@/services/authService';
import { resetSessionState } from '@/services/apiClient';
import { clearTokens, getAccessToken, storeTokens } from '@/services/secureStorage';

/**
 * The profile screen offered "Delete your account?" and promised "We remove
 * your personal data within 30 days" — and then called `signOut`. Nothing was
 * ever asked of anyone. A customer exercising their right to erasure under
 * POPIA got a sign-out and a sentence that was not true, and no record of the
 * request existed anywhere for the thirty days it named.
 *
 * Mock mode short-circuits every service before it reaches `request`, which is
 * exactly why an unsent request is invisible there. These drive the real
 * branch.
 */
const jsonResponse = (status: number, body: unknown = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const fetchMock = jest.fn();
const realUseMockApi = config.useMockApi;

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

beforeEach(async () => {
  fetchMock.mockReset();
  resetSessionState();
  await clearTokens();
  // The service branches on this, and the whole point is the branch that talks
  // to a server.
  (config as { useMockApi: boolean }).useMockApi = false;
});

afterAll(() => {
  (config as { useMockApi: boolean }).useMockApi = realUseMockApi;
});

describe('asking for an account to be deleted', () => {
  it('actually asks', async () => {
    await storeTokens('access-1', 'refresh-1');
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await deleteAccount();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${config.apiBaseUrl}/v1/account`);
    expect(init.method).toBe('DELETE');
  });

  it('sends it authenticated, or the server cannot know whose account it is', async () => {
    await storeTokens('access-1', 'refresh-1');
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await deleteAccount();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer access-1');
  });

  it('clears the tokens once the account is gone', async () => {
    await storeTokens('access-1', 'refresh-1');
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await deleteAccount();

    expect(await getAccessToken()).toBeNull();
  });

  /**
   * The one that matters. `signOut` swallows a failed request because
   * forgetting locally is the safer outcome there; here it is the opposite.
   * A customer left signed out believing their data is gone, when the request
   * never landed and the account still exists, is the worse wrong answer by a
   * distance.
   */
  it('does not pretend to have deleted anything when the request fails', async () => {
    await storeTokens('access-1', 'refresh-1');
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'Something went wrong' }));

    await expect(deleteAccount()).rejects.toThrow();

    // Still signed in, because nothing was deleted.
    expect(await getAccessToken()).toBe('access-1');
  });

  it('does not swallow a network failure either', async () => {
    await storeTokens('access-1', 'refresh-1');
    fetchMock.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(deleteAccount()).rejects.toThrow();
    expect(await getAccessToken()).toBe('access-1');
  });
});
