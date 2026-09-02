import type { ReactNode } from 'react';
import * as Clipboard from 'expo-clipboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, waitFor } from '@testing-library/react-native';
import OfferDetailScreen from '@/app/offers/[id]';
import { promotions } from '@/services/data/rewardsData';
import { useDialogStore } from '@/ux/dialog';

/**
 * Copying a promo code, and what happens when the copy does not happen.
 *
 * Found by sweeping for the rest of the `Alert` family — a tap that quietly
 * does the wrong thing on web — and the two platforms fail differently.
 *
 * Native rejects: `setStringAsync` was awaited with no catch and `setCopied`
 * sat after it, so a failure was an unhandled promise and a button that never
 * changed.
 *
 * The API also *resolves with a boolean*, which the old code threw away: it
 * read "resolved" as "copied" and put a tick on the button whatever came back.
 * That tick is a claim, and a customer who trusts it reaches checkout with an
 * empty paste.
 *
 * Both are covered below. One case is **not**, and the test for it would be
 * dishonest to write: on web, `expo-clipboard`'s `legacySetString` fallback
 * discards `document.execCommand`'s return value and reports `true` unless it
 * throws. Verified in Chromium against the real build — with `writeText`
 * rejecting and `execCommand` returning false, `setStringAsync` still resolves
 * `true`. The library reports a success the browser did not perform and no
 * caller can tell. What saves it is that the code is on screen next to the
 * button, so a silent failure is still readable and typeable.
 */
const codedOffer = promotions.find((promotion) => promotion.promoCode);
// `mock`-prefixed so the factory below may close over it.
const mockOfferId = codedOffer?.id;

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useLocalSearchParams: () => ({ id: mockOfferId }),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

let client: QueryClient;
// `initialMetrics` is required: without a seeded frame the safe-area values
// never resolve under test and `Screen` throws.
const withQueryClient = (node: ReactNode) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    }}
  >
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  </SafeAreaProvider>
);

describe('copying a promo code', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    useDialogStore.getState().reset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  it('has a seeded offer carrying a code, so this tests something', () => {
    expect(codedOffer?.promoCode).toBeTruthy();
  });

  it('confirms the copy when the clipboard accepts it', async () => {
    const write = jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
    const screen = render(withQueryClient(<OfferDetailScreen />));

    const button = await screen.findByTestId('offer-copy-code');
    button.props.onClick?.({});

    await waitFor(() => expect(write).toHaveBeenCalledWith(codedOffer?.promoCode));
    await waitFor(() => expect(screen.getByText('Copied')).toBeTruthy());
    // Nothing to apologise for, so nothing is said.
    expect(useDialogStore.getState().queue).toHaveLength(0);
  });

  /**
   * The web failure, and the one the old code got wrong in the dangerous
   * direction: a resolved promise carrying `false`.
   */
  it('never claims a copy that returned false', async () => {
    jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(false);
    const screen = render(withQueryClient(<OfferDetailScreen />));

    const button = await screen.findByTestId('offer-copy-code');
    button.props.onClick?.({});

    await waitFor(() => expect(useDialogStore.getState().queue).toHaveLength(1));
    expect(useDialogStore.getState().queue[0]?.message).toContain(codedOffer?.promoCode);
    // The tick is the whole hazard: it is a claim the app cannot support.
    expect(screen.queryByText('Copied')).toBeNull();
  });

  /**
   * The native failure. Before the catch, this test would have failed on the
   * unhandled rejection rather than on the assertion — there was no path
   * through it at all.
   */
  it('gives the customer the code when the clipboard throws', async () => {
    jest
      .spyOn(Clipboard, 'setStringAsync')
      .mockRejectedValue(
        new DOMException(
          "Failed to execute 'writeText': Document is not focused.",
          'NotAllowedError',
        ),
      );
    const screen = render(withQueryClient(<OfferDetailScreen />));

    const button = await screen.findByTestId('offer-copy-code');
    button.props.onClick?.({});

    await waitFor(() => expect(useDialogStore.getState().queue).toHaveLength(1));
    const notice = useDialogStore.getState().queue[0];
    // The code itself, so the offer is still usable by hand.
    expect(notice?.message).toContain(codedOffer?.promoCode);

    // And it must never claim success it did not have.
    expect(screen.queryByText('Copied')).toBeNull();
  });
});
