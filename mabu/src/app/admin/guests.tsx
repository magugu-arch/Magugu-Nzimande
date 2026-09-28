import { useState } from 'react';
import { View } from 'react-native';
import { AdminScreen } from '@/components/admin/Admin';
import { Card, LoadingBlock, Text, TextField } from '@/components/ui';
import { spacing } from '@/theme';
import { useRpc } from '@/services/queries';

/** §18 Guest CRM: visits, preferences and consent — only what service needs. */
export default function AdminGuests() {
  const [term, setTerm] = useState('');
  const q = useRpc('admin.guests', { term });
  return (
    <AdminScreen title="Guests">
      <View style={{ marginTop: spacing.md }}>
        <TextField
          label="Search guests"
          value={term}
          onChangeText={setTerm}
          autoCapitalize="none"
        />
      </View>
      {!q.data ? (
        <LoadingBlock />
      ) : (
        q.data.map((g) => (
          <Card key={g.id} style={{ marginBottom: spacing.sm, gap: 4 }}>
            <Text variant="title">{g.name || '—'}</Text>
            <Text variant="caption" color="textMuted" selectable>
              {g.email}
              {g.phone ? ` · ${g.phone}` : ''}
            </Text>
            <Text variant="caption" color="textSubtle">
              {g.visits} visit(s) · {g.upcoming} upcoming · rewards{' '}
              {g.rewardsOptIn ? 'member' : 'not joined'} · marketing{' '}
              {g.consent?.marketing ? 'opted in' : 'no consent'}
            </Text>
            {g.preferences?.dietaryTags?.length || g.preferences?.seatingPreference ? (
              <Text variant="caption" color="textSubtle">
                {[g.preferences?.dietaryTags?.join(', '), g.preferences?.seatingPreference]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
            {g.occasions?.length ? (
              <Text variant="caption" color="accent">
                {g.occasions.map((o) => `${o.label} ${o.date}`).join(' · ')}
              </Text>
            ) : null}
          </Card>
        ))
      )}
    </AdminScreen>
  );
}
