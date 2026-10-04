import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDirectory } from '@/data/hooks';
import {
  Card,
  Header,
  ListRow,
  QueryState,
  Screen,
  SearchField,
  StateView,
  spacing,
} from '@/design';

/** Staff directory (brief §3 staff "directory"; §6 "people" search). Work details only. */
export default function Directory() {
  const router = useRouter();
  const directory = useDirectory();
  const [query, setQuery] = useState('');
  return (
    <Screen
      header={<Header title="Directory" largeTitle="Staff directory" eyebrow="Campus" />}
      testID="directory"
    >
      <SearchField
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        label="Search by name or department"
      />
      <View style={{ marginTop: spacing.lg }}>
        <QueryState query={directory} what="the directory">
          {(list) => {
            const q = query.trim().toLowerCase();
            const shown = list.filter(
              (p) => !q || `${p.name} ${p.department} ${p.title}`.toLowerCase().includes(q),
            );
            if (!shown.length)
              return (
                <StateView
                  kind="empty"
                  title="No one matches"
                  body="Try a surname or a department."
                />
              );
            return (
              <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
                {shown.map((p) => (
                  <ListRow
                    key={p.id}
                    icon="person-circle-outline"
                    title={p.name}
                    subtitle={`${p.title} · ${p.department}`}
                    meta={[
                      p.office ? `Office ${p.office.code}` : null,
                      p.consultation ? `Consultation ${p.consultation}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    onPress={
                      p.office ? () => router.push(`/campus-map?to=${p.office!.code}`) : undefined
                    }
                    accessibilityHint={
                      p.office ? 'Shows their office on the campus map' : undefined
                    }
                  />
                ))}
              </Card>
            );
          }}
        </QueryState>
      </View>
    </Screen>
  );
}
