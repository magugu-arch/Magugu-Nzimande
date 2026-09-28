import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Chip,
  Header,
  InlineNotice,
  ListRow,
  LoadingBlock,
  PremiumButton,
  Screen,
  SectionTitle,
  Segmented,
  Text,
  TextField,
} from '@/components/ui';
import type { DietaryTag, Guest, GuestOccasion } from '@/domain/guests/types';
import { monthName } from '@/domain/shared/format';
import { errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { useSession } from '@/store/session';
import { spacing } from '@/theme';

const DIETARY: { tag: DietaryTag; label: string }[] = [
  { tag: 'vegetarian', label: 'Vegetarian' },
  { tag: 'vegan', label: 'Vegan' },
  { tag: 'gluten-free', label: 'Gluten-free' },
  { tag: 'halal', label: 'Halal' },
  { tag: 'dairy-free', label: 'Dairy-free' },
  { tag: 'nut-free', label: 'Nut-free' },
];

/** §25 GuestPreferenceForm, §16 Preferences and Occasions, and POPIA account deletion. */
export default function Details() {
  const me = useRpc('me.get');
  if (!me.data)
    return (
      <Screen header={<Header title="Details" />}>
        <LoadingBlock />
      </Screen>
    );
  // Keyed on the guest, so the form starts from their saved values without syncing state in an effect.
  return <DetailsForm key={me.data.id} me={me.data} />;
}

function DetailsForm({ me }: { me: Guest }) {
  const policy = useRpc('booking.policy');
  const save = useRpcMutation('me.update', ['me.get']);
  const saveOccasion = useRpcMutation('me.saveOccasion', ['me.get']);
  const removeOccasion = useRpcMutation('me.removeOccasion', ['me.get']);
  const del = useRpcMutation('me.delete');
  const session = useSession();
  const client = useQueryClient();

  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone);
  const [dietary, setDietary] = useState<DietaryTag[]>(me.preferences?.dietaryTags ?? []);
  const [seating, setSeating] = useState<string | undefined>(me.preferences?.seatingPreference);
  const [access, setAccess] = useState(me.preferences?.accessibilityNotes ?? '');
  const [occKind, setOccKind] = useState<GuestOccasion['kind']>('birthday');
  const [occDay, setOccDay] = useState('');
  const [occMonth, setOccMonth] = useState('');
  const [occLabel, setOccLabel] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const occasionDate = `${occMonth.padStart(2, '0')}-${occDay.padStart(2, '0')}`;

  return (
    <Screen header={<Header title="Details & preferences" />}>
      <SectionTitle eyebrow="You" title="Contact details" />
      <TextField label="Name" value={name} onChangeText={setName} autoComplete="name" />
      <TextField
        label="Mobile"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <Text variant="caption" color="textSubtle">
        Email: {me.email}
      </Text>

      <SectionTitle eyebrow="At the table" title="Dietary preferences" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {DIETARY.map((d) => (
          <Chip
            key={d.tag}
            label={d.label}
            selected={dietary.includes(d.tag)}
            onPress={() =>
              setDietary(
                dietary.includes(d.tag) ? dietary.filter((t) => t !== d.tag) : [...dietary, d.tag],
              )
            }
          />
        ))}
      </View>
      <SectionTitle eyebrow="At the table" title="Preferred seating" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {policy.data?.seatingAreas.map((a) => (
          <Chip
            key={a.id}
            label={a.label}
            selected={seating === a.id}
            onPress={() => setSeating(seating === a.id ? undefined : a.id)}
          />
        ))}
      </View>
      <View style={{ marginTop: spacing.lg }}>
        <TextField
          label="Accessibility needs"
          value={access}
          onChangeText={setAccess}
          multiline
          maxLength={300}
        />
      </View>
      {save.isError ? <InlineNotice tone="danger">{errorMessage(save.error)}</InlineNotice> : null}
      {save.isSuccess ? <InlineNotice tone="success">Saved.</InlineNotice> : null}
      <PremiumButton
        label="Save"
        loading={save.isPending}
        style={{ marginTop: spacing.md }}
        onPress={() =>
          save.mutate(
            {
              name,
              phone,
              preferences: {
                dietaryTags: dietary,
                seatingPreference: seating,
                accessibilityNotes: access,
              },
            },
            { onSuccess: (g) => session.setName(g.name) },
          )
        }
      />

      <SectionTitle eyebrow="Occasions" title="Days to remember" />
      <Text variant="bodySmall" color="textMuted" style={{ marginBottom: spacing.md }}>
        Tell us about birthdays and anniversaries so we can mark them with you.
      </Text>
      {me.occasions?.map((o) => (
        <ListRow
          key={o.id}
          label={`${o.label}`}
          value={`${Number(o.date.slice(3))} ${monthName(Number(o.date.slice(0, 2)) - 1)}`}
          right={
            <PremiumButton
              label="Remove"
              variant="ghost"
              compact
              onPress={() => removeOccasion.mutate({ id: o.id })}
            />
          }
        />
      ))}
      <Card style={{ marginTop: spacing.md }}>
        <Segmented
          value={occKind}
          onChange={setOccKind}
          options={[
            { value: 'birthday', label: 'Birthday' },
            { value: 'anniversary', label: 'Anniversary' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Day"
              value={occDay}
              onChangeText={(v) => setOccDay(v.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="14"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="Month"
              value={occMonth}
              onChangeText={(v) => setOccMonth(v.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="11"
            />
          </View>
        </View>
        <TextField
          label="Label"
          value={occLabel}
          onChangeText={setOccLabel}
          placeholder="e.g. Our anniversary"
        />
        {saveOccasion.isError ? (
          <InlineNotice tone="danger" style={{ marginBottom: spacing.md }}>
            {errorMessage(saveOccasion.error)}
          </InlineNotice>
        ) : null}
        <PremiumButton
          label="Add occasion"
          variant="secondary"
          loading={saveOccasion.isPending}
          onPress={() =>
            saveOccasion.mutate(
              {
                kind: occKind,
                label:
                  occLabel ||
                  (occKind === 'birthday'
                    ? 'Birthday'
                    : occKind === 'anniversary'
                      ? 'Anniversary'
                      : 'Occasion'),
                date: occasionDate,
              },
              {
                onSuccess: () => {
                  setOccDay('');
                  setOccMonth('');
                  setOccLabel('');
                },
              },
            )
          }
        />
      </Card>

      <SectionTitle eyebrow="Privacy" title="Your data" />
      <Text variant="bodySmall" color="textMuted">
        We keep only what we need to host you well. You can remove your account at any time; past
        bookings are kept without your name or contact details.
      </Text>
      {confirmDelete ? (
        <Card style={{ marginTop: spacing.md, gap: spacing.md }}>
          <Text variant="body">
            Delete your account and personal details? This cannot be undone.
          </Text>
          <PremiumButton
            label="Delete my account"
            variant="danger"
            loading={del.isPending}
            onPress={() =>
              del.mutate(undefined, {
                onSuccess: () => {
                  session.signOut();
                  client.clear();
                  router.replace('/home');
                },
              })
            }
          />
          <PremiumButton
            label="Keep my account"
            variant="ghost"
            onPress={() => setConfirmDelete(false)}
          />
        </Card>
      ) : (
        <PremiumButton
          label="Delete my account"
          variant="ghost"
          style={{ marginTop: spacing.md }}
          onPress={() => setConfirmDelete(true)}
        />
      )}
    </Screen>
  );
}
