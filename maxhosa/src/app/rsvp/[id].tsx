import { useRef, useState } from 'react';
import { Share, StyleSheet, Switch, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/Button';
import { ErrorText, Input } from '@/components/Field';
import { Group, Row } from '@/components/List';
import { PressableScale } from '@/components/PressableScale';
import { SheetScaffold } from '@/components/SheetScaffold';
import { ErrorState, LoadingSkeleton } from '@/components/States';
import { Text } from '@/components/Text';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import type { BrandEvent, Rsvp } from '@/domain/types';
import { addToCalendar } from '@/features/calendar';
import { inviteMessage, rsvpTitle, useEvent, useEventDate } from '@/features/events';
import { validateContact } from '@/features/validation';
import { providers } from '@/providers';
import { useEventsState } from '@/store/events';
import { usePrefs } from '@/store/prefs';

/**
 * RSVP in one short sheet. MAXHOSA's event system holds the place and
 * answers going, waitlist or requested; the follow-ups — calendar, invite,
 * the event edit — come straight after, while the intent is fresh.
 */
export default function RsvpSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useEvent(id);
  if (data.status === 'loading')
    return (
      <SheetScaffold title="RSVP">
        <LoadingSkeleton rows={1} />
      </SheetScaffold>
    );
  if (data.status === 'error' || !data.data.event)
    return (
      <SheetScaffold title="RSVP">
        <ErrorState message="This event couldn’t be loaded." onRetry={data.retry} />
      </SheetScaffold>
    );
  return <RsvpForm event={data.data.event} existing={data.data.rsvp} />;
}

function RsvpForm({ event, existing }: { event: BrandEvent; existing?: Rsvp }) {
  const { colors } = useTheme();
  const date = useEventDate()(event);
  const bump = useEventsState((s) => s.bump);
  const following = usePrefs((s) => s.notifications.collections.enabled);
  const setNotification = usePrefs((s) => s.setNotification);
  const invite = event.rsvp === 'invite-only';
  const [guests, setGuests] = useState<1 | 2>(1);
  const [form, setForm] = useState({ name: '', email: '' });
  const [updates, setUpdates] = useState(true);
  const [future, setFuture] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; submit?: string }>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Rsvp | null>(existing ?? null);
  const key = useRef<string | null>(null);

  const blur = (f: 'name' | 'email') =>
    setErrors((e) => ({ ...e, [f]: validateContact(f, form[f]) || undefined }));

  const submit = async () => {
    const next = {
      name: validateContact('name', form.name) || undefined,
      email: validateContact('email', form.email) || undefined,
    };
    setErrors(next);
    if (next.name || next.email) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    key.current ??= `rsvp-${event.id}-${Date.now()}`;
    setSending(true);
    try {
      const r = await providers.events.rsvp(
        { eventId: event.id, guests: invite ? 1 : guests, ...form, updates },
        key.current,
      );
      // Marketing is its own yes, recorded with its own consent time.
      if (future && !following) setNotification('collections', true);
      bump();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(r);
    } catch (e) {
      setErrors({ submit: e instanceof Error ? e.message : 'That didn’t go through. Try again.' });
    } finally {
      setSending(false);
    }
  };

  if (done) {
    const copy = {
      going: {
        icon: 'checkmark-circle' as const,
        tint: colors.green,
        title: 'You’re going (demo)',
        body: `Your place is held for ${date}. Venue details come with the confirmation.`,
      },
      waitlist: {
        icon: 'time' as const,
        tint: colors.ochre,
        title: 'You’re on the waitlist (demo)',
        body: 'The evening is full. MAXHOSA would tell you as soon as a place opens.',
      },
      requested: {
        icon: 'shield-checkmark' as const,
        tint: colors.cobalt,
        title: 'Invitation requested (demo)',
        body: 'Invitations are checked by MAXHOSA, never by the app alone. You would hear back by email.',
      },
    }[done.status];
    return (
      <SheetScaffold
        title={rsvpTitle(event)}
        footer={<Button label="Done" variant="secondary" onPress={() => router.back()} />}
      >
        <View style={styles.outcome} accessibilityLiveRegion="polite">
          <Ionicons name={copy.icon} size={48} color={copy.tint} />
          <Text variant="title" align="center" accessibilityRole="header">
            {copy.title}
          </Text>
          <Text variant="callout" color="ink2" align="center">
            {copy.body}
          </Text>
        </View>
        <View style={styles.bleed}>
          <Group>
            {done.status !== 'requested' ? (
              <Row
                first
                icon="calendar-outline"
                title="Add to calendar"
                subtitle="So the date is in your diary"
                onPress={() => void addToCalendar(event)}
              />
            ) : null}
            <Row
              first={done.status === 'requested'}
              icon="share-outline"
              title="Invite a friend"
              subtitle="Send the invite from your phone"
              onPress={() => void Share.share({ message: inviteMessage(event, date) })}
            />
            <Row
              icon="sparkles-outline"
              title="Shop the event edit"
              subtitle="Pieces chosen for the evening"
              onPress={() => router.back()}
            />
          </Group>
        </View>
      </SheetScaffold>
    );
  }

  return (
    <SheetScaffold
      title={rsvpTitle(event)}
      footer={
        <Button
          label={
            invite
              ? 'Send request (demo)'
              : event.availability === 'full'
                ? 'Join the waitlist (demo)'
                : 'Confirm RSVP (demo)'
          }
          busy={sending}
          onPress={() => void submit()}
        />
      }
    >
      <View style={{ gap: space.l }}>
        <Text variant="callout" color="ink2">
          {invite
            ? 'A small, invited evening. Requests are checked by MAXHOSA; the app never grants access on its own.'
            : `${date} · ${event.city}`}
        </Text>
        {!invite ? (
          <View style={{ gap: space.xs }}>
            <Text variant="footnote" weight="700" color="ink2">
              Who’s coming
            </Text>
            <View
              style={[styles.segment, { backgroundColor: colors.sunk }]}
              accessibilityRole="radiogroup"
              accessibilityLabel="Guests"
            >
              {([1, 2] as const).map((g) => (
                <PressableScale
                  key={g}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: guests === g }}
                  onPress={() => setGuests(g)}
                  style={[styles.segmentItem, guests === g && { backgroundColor: colors.card }]}
                >
                  <Text variant="subhead" weight="600" color={guests === g ? 'ink' : 'ink2'}>
                    {g === 1 ? 'Just me' : 'Me + 1'}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </View>
        ) : null}
        <Input
          label="Name"
          value={form.name}
          error={errors.name}
          autoComplete="name"
          onChange={(name) => setForm((f) => ({ ...f, name }))}
          onBlur={() => blur('name')}
        />
        <Input
          label="Email"
          value={form.email}
          error={errors.email}
          autoComplete="email"
          keyboardType="email-address"
          onChange={(email) => setForm((f) => ({ ...f, email }))}
          onBlur={() => blur('email')}
        />
        <View style={styles.bleed}>
          <Group>
            <Row
              first
              title="Updates about this event"
              subtitle="Changes, venue details, a reminder"
              end={
                <Switch
                  value={updates}
                  onValueChange={setUpdates}
                  trackColor={{ true: colors.green, false: colors.hairlineStrong }}
                  accessibilityLabel="Updates about this event"
                />
              }
            />
            {!following ? (
              <Row
                title="Tell me about future events"
                subtitle="Marketing · off unless you switch it on"
                end={
                  <Switch
                    value={future}
                    onValueChange={setFuture}
                    trackColor={{ true: colors.green, false: colors.hairlineStrong }}
                    accessibilityLabel="Tell me about future events"
                  />
                }
              />
            ) : null}
          </Group>
        </View>
        {errors.submit ? <ErrorText text={errors.submit} /> : null}
        <Text variant="footnote" color="ink3">
          Used only for this event.
          {providers.events.isMock ? ' In this demo nothing is sent.' : ''}
        </Text>
      </View>
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  // Groups carry the page gutter; inside a sheet they line up with the fields instead.
  bleed: { marginHorizontal: -space.gutter },
  outcome: { alignItems: 'center', gap: space.s, paddingVertical: space.l },
  segment: { flexDirection: 'row', padding: 3, borderRadius: radius.s },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.s - 2,
  },
});
