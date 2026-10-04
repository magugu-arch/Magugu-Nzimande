import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { providers } from '@/core/adapters/registry';
import { isAdapterError } from '@/core/adapters/errors';
import type { ResidenceRequest } from '@/core/domain/models';
import {
  Button,
  ChipRow,
  Header,
  Notice,
  Screen,
  SectionHeader,
  Text,
  TextField,
  colors,
  spacing,
} from '@/design';
import { useSession } from '@/state/session';
import { showToast } from '@/state/toasts';

const CATEGORIES: { value: ResidenceRequest['category']; label: string }[] = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'internet', label: 'Internet' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'security', label: 'Security' },
  { value: 'other', label: 'Other' },
];

/** Log a residence request — the answer to "Who handles residence requests?" (brief §6). */
export default function ResidenceRequestScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useSession((s) => s.user?.id);
  const [category, setCategory] = useState<ResidenceRequest['category']>('maintenance');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = description.trim().length > 0 && description.trim().length < 10;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const r = await providers.residence.submitRequest({ category, description });
      void queryClient.invalidateQueries({ queryKey: ['residence', userId] });
      showToast({ title: `Request sent · ${r.reference}`, body: 'The residence office will update it here.', tone: 'success' });
      router.replace('/residence');
    } catch (e) {
      setError(isAdapterError(e) && e.kind === 'offline' ? 'You’re offline. Your request wasn’t sent — try again when connected.' : isAdapterError(e) && e.kind === 'invalid' ? e.message : 'The request didn’t go through. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      header={<Header title="New request" fallbackHref="/residence" />}
      footer={<Button label="Send to the residence office" variant="accent" fullWidth loading={submitting} disabled={description.trim().length < 10} onPress={submit} testID="residence-submit" />}
      testID="residence-request"
    >
      <View style={{ gap: spacing.lg }}>
        <Text variant="title1" accessibilityRole="header">
          What needs attention?
        </Text>
        <Text variant="body" color={colors.textSecondary}>
          Requests go straight to your residence office. You’ll see progress here.
        </Text>
        <View>
          <SectionHeader title="Type" />
          <ChipRow value={category} onChange={setCategory} options={CATEGORIES} />
        </View>
        {category === 'security' ? (
          <Notice tone="warning" title="Is someone at risk right now?" body="Don’t wait for a request — call 10111, or use Safety." action="Open Safety" onAction={() => router.push('/safety')} />
        ) : null}
        <TextField
          label="Describe the problem"
          multiline
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. The desk lamp in C214 flickers and switches off."
          hint="Room number and what’s wrong help the team come prepared."
          error={tooShort ? 'A few more words, please' : null}
          testID="residence-description"
        />
        {error ? <Notice tone="danger" title="Not sent" body={error} /> : null}
      </View>
    </Screen>
  );
}
