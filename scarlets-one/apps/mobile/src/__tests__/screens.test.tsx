import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { ReactElement } from 'react';
import HomeScreen from '@/app/(tabs)/index';
import MatchScreen from '@/app/(tabs)/match';
import PassportScreen from '@/app/(tabs)/passport';
import { ApiProvider } from '@/data/api';
import { useDemo } from '@/state/demo';
import { usePrefs } from '@/state/prefs';
import { useSession } from '@/state/session';

let client: QueryClient;

function renderScreen(ui: ReactElement) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ApiProvider>{ui}</ApiProvider>
    </QueryClientProvider>,
  );
}

/** Wait for every query the screen started, so nothing updates after the test ends. */
const settled = () => waitFor(() => expect(client.isFetching()).toBe(0));

afterEach(async () => {
  await settled();
});

beforeEach(() => {
  usePrefs.setState({
    hydrated: true,
    onboarded: true,
    locale: 'en',
    theme: 'light',
    following: ['first_team'],
  });
  useSession.setState({ account: 'guest' });
  useDemo.getState().reset();
  jest.clearAllMocks();
});

describe('Home', () => {
  it('shows the next fixture, labelled as demo data, with a ticket link-out', async () => {
    renderScreen(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('hero-tickets')).toBeOnTheScreen());
    expect(screen.getAllByText('Connacht').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DEMO').length).toBeGreaterThan(0);
    expect(screen.getByText('Example fixture')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('hero-tickets'));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://www.scarlets.wales/tickets-ticket-information/',
    );
  });

  it('gives the hero buttons names a screen reader can use', async () => {
    renderScreen(<HomeScreen />);
    // The hero button and the quick link both lead to tickets, and both say so.
    await waitFor(() =>
      expect(screen.getAllByLabelText('Tickets').length).toBeGreaterThanOrEqual(1),
    );
    expect(screen.getByLabelText('Plan your day')).toBeOnTheScreen();
    expect(screen.getByLabelText('More')).toBeOnTheScreen();
  });

  it('withholds the ticket link when ticketing is down, and says why', async () => {
    useDemo.getState().set({ ticketing: 'down' });
    renderScreen(<HomeScreen />);
    await waitFor(() => expect(screen.getByText(/Ticketing isn’t responding/)).toBeOnTheScreen());
    fireEvent.press(screen.getByTestId('hero-tickets'));
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it('leads with a labelled simulation while a match is live', async () => {
    useDemo.getState().setScenario('live');
    renderScreen(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('hero-centre')).toBeOnTheScreen());
    expect(screen.getAllByText('Demo simulation. Not a real score.').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('hero-tickets')).toBeNull();
  });

  it('switches to Welsh without losing the screen', async () => {
    usePrefs.setState({ locale: 'cy' });
    renderScreen(<HomeScreen />);
    await waitFor(() =>
      expect(screen.getAllByLabelText('Tocynnau').length).toBeGreaterThanOrEqual(1),
    );
    expect(screen.getByText(/Gêm nesaf/)).toBeOnTheScreen();
  });
});

describe('Match', () => {
  it('lists fixtures and opens one in Match Centre', async () => {
    renderScreen(<MatchScreen />);
    await waitFor(() =>
      expect(screen.getByTestId('fixture-fx-example-connacht')).toBeOnTheScreen(),
    );
    fireEvent.press(screen.getByTestId('fixture-fx-example-connacht'));
    expect(useRouter().push).toHaveBeenCalledWith({
      pathname: '/fixture/[id]',
      params: { id: 'fx-example-connacht' },
    });
  });

  it('withholds the league table instead of working one out', async () => {
    renderScreen(<MatchScreen />);
    await waitFor(() => expect(screen.getByTestId('match-view-table')).toBeOnTheScreen());
    fireEvent.press(screen.getByTestId('match-view-table'));
    await waitFor(() => expect(screen.getByText(/licensed competition feed/)).toBeOnTheScreen());
  });
});

describe('Passport', () => {
  it('asks a guest to sign in and shows no membership data', async () => {
    renderScreen(<PassportScreen />);
    await waitFor(() => expect(screen.getByTestId('passport-guest')).toBeOnTheScreen());
    expect(screen.queryByTestId('passport-card')).toBeNull();
  });

  it('shows a member their card and benefits, and no points balance', async () => {
    useSession.setState({ account: 'member' });
    renderScreen(<PassportScreen />);
    await waitFor(() => expect(screen.getByTestId('passport-card')).toBeOnTheScreen());
    expect(screen.getByText('YMLAEN')).toBeOnTheScreen();
    expect(screen.getByText('Nothing to show yet')).toBeOnTheScreen();
    expect(screen.getByTestId('benefit-vx3')).toBeOnTheScreen();
    expect(screen.queryByText(/\d+\s*(points|pts)/i)).toBeNull();
  });

  it('pauses redemption and says so when rewards are down', async () => {
    useSession.setState({ account: 'member' });
    useDemo.getState().set({ rewards: 'down' });
    renderScreen(<PassportScreen />);
    await waitFor(() =>
      expect(screen.getByText('Redemption is paused until rewards are back.')).toBeOnTheScreen(),
    );
  });
});
