import { useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { providers } from '@/core/adapters/registry';
import { useSocieties } from '@/data/hooks';
import {
  Button,
  Card,
  Header,
  Pill,
  QueryState,
  Row,
  Screen,
  Text,
  colors,
  spacing,
} from '@/design';
import { useCan } from '@/features/access/access';
import { showToast } from '@/state/toasts';

/** Society discovery and joining (brief §12). A directory, not a feed. */
export default function Societies() {
  const queryClient = useQueryClient();
  const societies = useSocieties();
  const canJoin = useCan('societies.join');
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (id: string, name: string) => {
    setBusy(id);
    try {
      const r = await providers.community.joinSociety(id);
      showToast({ title: r.joined ? `You joined ${name}` : `You left ${name}`, tone: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['societies'] });
    } catch {
      showToast({ title: 'That didn’t save — try again', tone: 'info' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      header={<Header title="Societies" largeTitle="Find your people" eyebrow="Community" />}
      testID="societies"
    >
      <QueryState query={societies} what="societies">
        {(list) => (
          <View style={{ gap: spacing.md }}>
            {list.map((s) => (
              <Card key={s.id}>
                <Row justify="space-between">
                  <Text variant="title3">{s.name}</Text>
                  <Pill label={s.category} />
                </Row>
                <Text variant="body">{s.description}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {s.members.toLocaleString('en-ZA')} members · {s.meets}
                </Text>
                {canJoin ? (
                  <Button
                    label={s.joined ? 'Joined' : 'Join'}
                    icon={s.joined ? 'checkmark' : 'add'}
                    variant={s.joined ? 'secondary' : 'primary'}
                    size="md"
                    loading={busy === s.id}
                    onPress={() => toggle(s.id, s.name)}
                    style={{ marginTop: spacing.md }}
                    accessibilityHint={s.joined ? 'Leaves this society' : 'Joins this society'}
                  />
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}
