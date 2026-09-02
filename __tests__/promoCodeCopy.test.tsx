import type { ReactNode } from 'react';
import * as Clipboard from 'expo-clipboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, waitFor } from '@testing-library/react-native';
import OfferDetailScreen from '@/app/offers/[id]';
import { promotions } from '@/services/data/rewardsData';
import { useDialogStore } from '@/ux/dialog';

/**
 * Copying a promo code, and what happens when the browser says no.
 *
 * The same family as the `Alert` defect: a tap that silently does nothing on
 * web. `Clipboard.setStringAsync` was awaited with no catch and `setCopied`
 * sat after it, so a rejection was an unhandled promise *and* a button that
 * never changed — the customer taps Copy, nothing happens, and they still have
 * no code to type at checkout.
 *
 * Rejection here is ordinary rather than exotic. `navigator.clipboard
 * .writeText` throws `NotAllowedError` when the document is not focused, when
 * the permission is refused, and inside an iframe without `clipboard-write` —
 * which is how a published web preview of this app is rendered. Reproduced in
 * Chromium: an iframe without that permission fails with "Document is not
 * focused."
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
   * The defect, as a customer meets it. Before the catch, this test would have
   * failed on the unhandled rejection rather than on the assertion — which is
   * the point: there was no path through the failure at all.
   */
  it('gives the customer the code when the clipboard refuses', async () => {
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
