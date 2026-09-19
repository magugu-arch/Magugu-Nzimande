import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import WelcomeScreen from '@/app/(onboarding)/welcome';
import { useAuthStore } from '@/store/authStore';

/**
 * The first screen of the app, and whether its button works.
 *
 * `welcome` shows three slides and advances them with one control. It did so
 * by calling `scrollToOffset` and then waiting for `onMomentumScrollEnd` to
 * hand the new position back — which is what a *swipe* produces, and not what
 * a programmatic scroll reliably produces on either platform.
 *
 * So `index` never left zero. The photograph slid across; the pips, the
 * headline, the body and the button's own label did not. Pressing Next a
 * second time recomputed the same offset and went nowhere, so the onboarding
 * could not be completed by the button that exists to complete it — the only
 * way out was Skip, which is the one path that skips the introduction.
 *
 * Nothing caught it. There was no render test of this screen at all, and the
 * screen sweep loads every route but never presses anything, so it saw a
 * correct first slide and moved on. A defect on the first screen of the app,
 * behind the first tap anybody makes.
 *
 * These assert what a person sees after a press, rather than that a handler
 * fired: the pressing is the part that was never wrong.
 */

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

function renderWelcome() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <WelcomeScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockReplace.mockClear();
  useAuthStore.setState({ hasCompletedOnboarding: false });
});

describe('the onboarding carousel advances', () => {
  it('shows the first slide before anything is pressed', () => {
    renderWelcome();
    expect(screen.getByText('A taste of a brighter life')).toBeTruthy();
    expect(screen.getByTestId('onboarding-next')).toBeTruthy();
  });

  it('moves the copy, not just the photograph, when Next is pressed', () => {
    renderWelcome();
    fireEvent.press(screen.getByTestId('onboarding-next'));

    // The whole defect in one assertion: the second slide's words.
    expect(screen.getByText('Your table, in a few taps')).toBeTruthy();
    expect(screen.queryByText('A taste of a brighter life')).toBeNull();
  });

  it('reaches the last slide and relabels the button', () => {
    renderWelcome();
    fireEvent.press(screen.getByTestId('onboarding-next'));
    fireEvent.press(screen.getByTestId('onboarding-next'));

    expect(screen.getByText('Good food. Great company.')).toBeTruthy();
    // "Next" through three slides never became "Get started", so the customer
    // was never offered the end of the carousel.
    expect(screen.getByText('Get started')).toBeTruthy();
  });

  it('finishes onboarding from the last slide rather than scrolling past it', () => {
    renderWelcome();
    fireEvent.press(screen.getByTestId('onboarding-next'));
    fireEvent.press(screen.getByTestId('onboarding-next'));
    fireEvent.press(screen.getByTestId('onboarding-next'));

    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });

  it('still lets somebody skip straight out', () => {
    renderWelcome();
    fireEvent.press(screen.getByLabelText('Skip onboarding'));

    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });
});
