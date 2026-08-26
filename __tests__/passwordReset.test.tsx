import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ResetPasswordScreen from '@/app/(auth)/reset-password';
import { confirmPasswordReset } from '@/services/authService';

// Both prefixed `mock` so jest lets the factory close over them.
const mockReplace = jest.fn();
let mockParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/services/authService', () => ({
  confirmPasswordReset: jest.fn(),
}));

const confirm = confirmPasswordReset as jest.MockedFunction<typeof confirmPasswordReset>;

/** `Screen` reads the safe-area inset, which needs a provider with a frame. */
function Wrapped({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {children}
    </SafeAreaProvider>
  );
}

const show = () =>
  render(
    <Wrapped>
      <ResetPasswordScreen />
    </Wrapped>,
  );

/**
 * The other end of the link in the reset email, which had no other end.
 *
 * `forgot-password` told the customer "we have sent a link to reset your
 * password. It expires in 30 minutes", and no route matched it — so
 * expo-router sent them to `+not-found`: "This page has moved on. We couldn't
 * find what you were looking for. It may have been taken off the menu."
 * Somebody locked out of their own account, told their password reset was off
 * the menu.
 *
 * Driven here rather than in the browser sweep because the sweep visits routes
 * by URL and this one only means anything with a token on it — and because the
 * thing worth checking is the sequence, not the layout.
 */
describe('landing on the reset link', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    confirm.mockReset();
    confirm.mockResolvedValue(undefined);
    mockParams = { token: 'reset-token-abc123' };
  });

  const type = (testID: string, value: string) =>
    fireEvent.changeText(screen.getByTestId(testID), value);

  const submit = () => fireEvent.press(screen.getByTestId('reset-password-submit'));

  it('sets the new password and sends the token back untouched', async () => {
    show();
    type('reset-password-new', 'chickenchicken1');
    type('reset-password-confirm', 'chickenchicken1');
    submit();

    await waitFor(() => {
      // Handed back exactly as it arrived. Whether a reset token is still good
      // is a judgement for the side that issued it.
      expect(confirm).toHaveBeenCalledWith('reset-token-abc123', 'chickenchicken1');
    });
    await waitFor(() => expect(screen.getByTestId('reset-password-done')).toBeTruthy());
  });

  it('refuses two passwords that do not match, without asking the server', () => {
    show();
    type('reset-password-new', 'chickenchicken1');
    type('reset-password-confirm', 'chickenchicken2');
    submit();

    // The server only ever receives one of the two, so a mistyped second box
    // would otherwise hand somebody a password they do not know they have.
    expect(screen.getByText('Those passwords do not match')).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('holds a new password to the same rule as a new account', () => {
    show();
    type('reset-password-new', 'short');
    type('reset-password-confirm', 'short');
    submit();

    expect(screen.getByText('Password must be at least 8 characters')).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('says so up front when the link carries no token', () => {
    // An email client that truncates the URL, or somebody typing it by hand.
    mockParams = {};
    show();

    expect(screen.getByTestId('reset-password-no-token')).toBeTruthy();
    // Better than letting them choose a password and then refusing it.
    expect(screen.queryByTestId('reset-password-submit')).toBeNull();
  });

  it('offers a fresh link rather than a dead end', () => {
    mockParams = {};
    show();
    fireEvent.press(screen.getByText('Send a new link'));

    expect(mockReplace).toHaveBeenCalledWith('/(auth)/forgot-password');
  });

  it('shows the server’s own words when it refuses the token', async () => {
    confirm.mockRejectedValue(new Error('That reset link has expired. Ask for a new one.'));

    show();
    type('reset-password-new', 'chickenchicken1');
    type('reset-password-confirm', 'chickenchicken1');
    submit();

    await waitFor(() =>
      expect(screen.getByText('That reset link has expired. Ask for a new one.')).toBeTruthy(),
    );
    // Still on the form, with what they typed, so they can try the newer link.
    expect(screen.getByTestId('reset-password-submit')).toBeTruthy();
  });

  it('sends them to sign in afterwards, not into the app', async () => {
    show();
    type('reset-password-new', 'chickenchicken1');
    type('reset-password-confirm', 'chickenchicken1');
    submit();

    await waitFor(() => expect(screen.getByTestId('reset-password-done')).toBeTruthy());
    fireEvent.press(screen.getByTestId('reset-password-sign-in'));

    // The reset link proves they can read the inbox, not that they are signed
    // in — and any other device holding the old password has to be told too.
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });
});
