import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { MAX_AGE_MS } from '@kc-one/contracts';
import {
  AppHeader,
  Button,
  EmptyState,
  Eyebrow,
  Headline,
  LoadingBlock,
  Notice,
  ProvenanceLine,
  QueryState,
  Screen,
  Text,
} from '@/components';
import { capabilities } from '@/config/env';
import { useTickets } from '@/data/queries';
import { SignInGate } from '@/features/auth/SignInGate';
import { TicketCard } from '@/features/tickets/TicketCard';
import { space } from '@/theme';

export default function Tickets() {
  const router = useRouter();
  const q = useTickets();
  return (
    <Screen
      inTabs
      topInset={false}
      header={<AppHeader subline="Ticket Wallet" />}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
    >
      <View style={{ gap: space.xl }}>
        <Eyebrow>Ticket Wallet</Eyebrow>
        <Headline lead="Your seat" accent="is waiting." size="display" />
        <SignInGate
          title="Sign in for your tickets"
          body="Tickets belong to your account and come from the club’s official ticketing provider."
        >
          <QueryState query={q} loading={<LoadingBlock lines={1} />}>
            {(tickets, provenance) => (
              <View style={{ gap: space.lg }}>
                {tickets.length === 0 ? (
                  <EmptyState
                    icon="ticket-outline"
                    title="No tickets yet"
                    body="Tickets you buy from the official ticketing provider appear here."
                  />
                ) : (
                  tickets.map((t) => (
                    <TicketCard
                      key={t.id}
                      ticket={t}
                      onPress={() => router.push(`/tickets/${t.id}`)}
                    />
                  ))
                )}
                <ProvenanceLine
                  provenance={provenance}
                  maxAgeMs={MAX_AGE_MS.tickets}
                  sourceLabel="Ticketing provider"
                />
              </View>
            )}
          </QueryState>
        </SignInGate>
        <View style={{ gap: space.md }}>
          <Text variant="title3">Buy tickets</Text>
          {capabilities.tickets === 'live' ? (
            <Button
              label="Choose a match"
              icon="calendar-outline"
              onPress={() => router.push('/match')}
            />
          ) : (
            <Notice
              compact
              reason="integration_pending"
              title="Ticket sales not connected"
              body="Buying opens through the club’s official ticketing provider once it is connected. The app never takes ticket payments itself."
            />
          )}
        </View>
      </View>
    </Screen>
  );
}
