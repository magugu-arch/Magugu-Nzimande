import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import {
  Card,
  Header,
  InlineNotice,
  LoadingBlock,
  PremiumButton,
  Screen,
  SectionTitle,
  Text,
} from '@/components/ui';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { colors, radius, spacing } from '@/theme';
import { shareText } from '@/utils/linking';

/**
 * POPIA §23: a guest may ask what we hold about them. This shows all of it and
 * lets them keep a copy, without writing to anyone or waiting on a request.
 */
export default function YourDataScreen() {
  const q = useRpc('me.export');
  const [showAll, setShowAll] = useState(false);
  const data = q.data;
  const json = data ? JSON.stringify(data, null, 2) : '';

  const counts = data
    ? [
        ['Bookings', data.bookings.length],
        ['Events', data.events.length],
        ['Gift vouchers', data.vouchers.length],
        ['Favourites', data.favourites.length],
        ['Messages sent to you', data.notifications.messages.length],
        ['Devices for notifications', data.devices.length],
      ]
    : [];

  return (
    <Screen
      meta={{ title: 'What we hold about you', noindex: true }}
      header={<Header title="What we hold about you" />}
      footer={
        data ? (
          <PremiumButton
            label="Share a copy"
            icon="share"
            onPress={() => void shareText('My Mábu data', json)}
          />
        ) : undefined
      }
    >
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <InlineNotice tone="danger" style={{ marginTop: spacing.lg }}>
          {errorMessage(q.error)}
        </InlineNotice>
      ) : data ? (
        <>
          <Text variant="body" color="textMuted" style={{ marginTop: spacing.md }}>
            {data.about}
          </Text>

          <SectionTitle eyebrow="You" title="Your details" />
          <Card style={{ gap: 4 }}>
            <Text variant="title">{data.you.name || 'No name saved'}</Text>
            <Text variant="bodySmall" color="textMuted" selectable>
              {data.you.email}
              {data.you.phone ? ` · ${data.you.phone}` : ''}
            </Text>
            <Text variant="caption" color="textSubtle">
              {data.you.rewardsMember ? 'MÁBU Rewards member' : 'Not in MÁBU Rewards'} ·{' '}
              {data.you.consent?.marketing ? 'opted in to news' : 'no marketing consent'}
            </Text>
          </Card>

          <SectionTitle eyebrow="Your record" title="What that adds up to" />
          {counts.map(([label, n]) => (
            <View
              key={label}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: spacing.sm,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.border,
              }}
            >
              <Text variant="body" color="textMuted">
                {label}
              </Text>
              <Text variant="body">{n}</Text>
            </View>
          ))}

          <SectionTitle eyebrow="Everything" title="The full record" />
          <PremiumButton
            label={showAll ? 'Hide the full record' : 'Show the full record'}
            variant="secondary"
            compact
            onPress={() => setShowAll(!showAll)}
          />
          {showAll ? (
            <ScrollView
              horizontal
              style={{
                marginTop: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.md,
                maxHeight: 420,
              }}
            >
              <Text variant="caption" color="textMuted" selectable>
                {json}
              </Text>
            </ScrollView>
          ) : null}

          <PremiumButton
            label="Delete my account"
            variant="ghost"
            style={{ marginTop: spacing.xl }}
            onPress={() => router.push('/profile/details')}
          />
        </>
      ) : null}
    </Screen>
  );
}
