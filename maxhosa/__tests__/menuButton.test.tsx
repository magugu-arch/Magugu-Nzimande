import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MenuButton } from '@/components/MenuButton';
import { usePrefs } from '@/store/prefs';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => undefined) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));

function openMenu() {
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <MenuButton />
    </SafeAreaProvider>,
  );
  const button = screen.getByLabelText('Menu');
  // measureInWindow has no layout under Jest; answer it as a laid-out button would.
  const host = screen.UNSAFE_root.findAll((n) => typeof n.props.collapsable === 'boolean')[0]!;
  host.instance.measureInWindow = (cb: (x: number, y: number, w: number, h: number) => void) =>
    cb(8, 40, 44, 44);
  fireEvent(button, 'pressIn');
  return button;
}

describe('MenuButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens on the press and says it is expanded', () => {
    const button = openMenu();
    expect(screen.getByText('Events calendar')).toBeTruthy();
    expect(button.props.accessibilityState).toEqual({ expanded: true });
  });

  it('closes, then goes where the item says', () => {
    openMenu();
    act(() => fireEvent.press(screen.getByTestId('menu-events')));
    expect(router.push).toHaveBeenCalledWith('/events');
  });

  it('changes appearance in place, without leaving', () => {
    openMenu();
    fireEvent.press(screen.getByLabelText('Dark appearance'));
    expect(usePrefs.getState().appearance).toBe('dark');
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Dark appearance').props.accessibilityState).toEqual({
      checked: true,
    });
  });
});
