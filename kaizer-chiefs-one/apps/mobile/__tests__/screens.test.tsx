import { render, screen } from '@testing-library/react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ProviderResult } from '@kc-one/contracts';
import { QueryState } from '@/components/StateViews';
import { Text } from '@/components/Text';
import { FixtureCard } from '@/features/football/FixtureCard';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

function query<T>(
  data: ProviderResult<T> | undefined,
  extra: Partial<UseQueryResult<ProviderResult<T>>> = {},
) {
  return {
    data,
    isPending: !data,
    isError: false,
    refetch: jest.fn(),
    ...extra,
  } as unknown as UseQueryResult<ProviderResult<T>>;
}

describe('QueryState', () => {
  it('shows the honest reason when a provider is unavailable', () => {
    render(
      <QueryState
        query={query<string>({
          status: 'unavailable',
          reason: 'integration_pending',
          message: 'Feed not connected',
        })}
      >
        {(d) => <Text>{d}</Text>}
      </QueryState>,
    );
    expect(screen.getByText('Not connected yet')).toBeTruthy();
    expect(screen.getByText('Feed not connected')).toBeTruthy();
  });

  it('offers a retry on failure', () => {
    render(
      <QueryState query={query<string>(undefined, { isPending: false, isError: true })}>
        {(d) => <Text>{d}</Text>}
      </QueryState>,
    );
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});

describe('FixtureCard', () => {
  it('shows a demo fixture as unconfirmed, with no score', () => {
    render(
      <FixtureCard
        fixture={{
          id: 'f',
          competition: { id: 'c', name: 'Competition name (demo)' },
          home: { teamId: 'kc', name: 'Kaizer Chiefs', isClub: true, badgePath: null },
          away: { teamId: 'o', name: 'Opponent A', isClub: false, badgePath: null },
          venue: null,
          kickoff: null,
          kickoffConfirmed: false,
          status: 'completed',
          score: null,
          ticketingAvailable: false,
          provenance: {
            source: 'demo',
            providerRef: null,
            fetchedAt: new Date().toISOString(),
            updatedAt: null,
            state: 'demo',
          },
        }}
      />,
    );
    expect(screen.getByText('TBC')).toBeTruthy();
    expect(screen.getByText('VS')).toBeTruthy();
    expect(screen.getByText('DEMO')).toBeTruthy();
    expect(screen.getByLabelText(/Demo fixture/)).toBeTruthy();
  });
});
