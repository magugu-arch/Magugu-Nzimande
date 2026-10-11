import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { Chip } from '@/components/Chip';
import { Group, Row } from '@/components/List';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { EmptyState, LoadingSkeleton } from '@/components/States';
import { Text } from '@/components/Text';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import type { Appointment, AvailableSlot } from '@/domain/types';
import { useAsync } from '@/features/async';
import { useMarket } from '@/features/catalogue';
import { providers } from '@/providers';
import { validateContact as validate, type ContactField as Field } from '@/features/validation';
import catalogue from '@data/sample-catalogue.json';

/**
 * A styling enquiry. With no booking system connected it can only ever be a
 * request: sample times, pending confirmation, nothing booked. The provider
 * holds the slot and the idempotency key, so a double tap cannot double-book.
 */
export default function AppointmentScreen() {
  const { product } = useLocalSearchParams<{ product?: string }>();
  const { colors } = useTheme();
  const market = useMarket();
  const booking = providers.booking;
  const types = useAsync(() => booking.listTypes(), []);
  const [typeId, setTypeId] = useState<string | null>(null);
  const slots = useAsync(
    () => (typeId ? booking.listSlots(typeId, new Date(), 14) : Promise.resolve([])),
    [typeId],
  );
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const interested = product ? catalogue.products.find((p) => p.id === product) : undefined;
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    notes: interested ? `Interested in: ${interested.name} (${interested.code})` : '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field | 'type' | 'slot', string>>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Appointment | null>(null);
  const key = useRef<string | null>(null);

  const days = useMemo(() => {
    const byDay = new Map<string, AvailableSlot[]>();
    for (const s of slots.data ?? []) {
      const d = s.startsAt.slice(0, 10);
      byDay.set(d, [...(byDay.get(d) ?? []), s]);
    }
    return [...byDay.entries()];
  }, [slots.data]);

  const blur = (f: Field) => setErrors((e) => ({ ...e, [f]: validate(f, form[f]) || undefined }));

  const submit = async () => {
    const next: typeof errors = {
      type: typeId ? undefined : 'Choose the kind of appointment.',
      slot: slot ? undefined : 'Choose a day and time.',
      name: validate('name', form.name) || undefined,
      email: validate('email', form.email) || undefined,
      phone: validate('phone', form.phone) || undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    key.current ??= `apt-${Date.now()}`;
    setSending(true);
    try {
      const a = await booking.requestAppointment(
        {
          typeId: typeId!,
          slotId: slot!.id,
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          notes: form.notes || undefined,
        },
        key.current!,
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(a);
    } catch (e) {
      setErrors({ slot: e instanceof Error ? e.message : 'That time is no longer available.' });
    } finally {
      setSending(false);
    }
  };

  const fmtDay = (iso: string, style: 'short' | 'long') =>
    new Intl.DateTimeFormat(
      market.locale,
      style === 'short' ? { weekday: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' },
    ).format(new Date(`${iso}T12:00:00`));
  const local = (s: AvailableSlot) => {
    const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (here === s.timeZone) return null;
    return new Intl.DateTimeFormat(market.locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(s.startsAt));
  };

  if (sent) {
    const type = types.data?.find((t) => t.id === sent.typeId);
    return (
      <Screen title="Styling appointment">
        <EmptyState
          icon="time-outline"
          title="Enquiry received (demo)"
          body="Pending confirmation — no time has been booked. MAXHOSA client care would reply to confirm."
        />
        <Group>
          <Row first title={sent.reference} subtitle="Reference" />
          <Row
            title={`${type?.label ?? ''} · about ${type?.minutes ?? ''} min`}
            subtitle="Service"
          />
          <Row
            title={`${fmtDay(sent.slot.startsAt.slice(0, 10), 'long')} at ${sent.slot.startsAt.slice(11, 16)} SAST (sample)`}
            subtitle="Requested"
          />
          <Row
            title={
              type?.format === 'virtual'
                ? 'Video call — link sent on confirmation'
                : 'In person — location confirmed by client care'
            }
            subtitle="Where"
          />
          <Row
            title="Follows the policy sent with the confirmation"
            subtitle="Rescheduling and cancellation"
          />
        </Group>
        <View style={{ padding: space.gutter }}>
          <Button
            label="Add to calendar — after confirmation"
            variant="secondary"
            icon="calendar-outline"
            disabled
            onPress={() => undefined}
            accessibilityHint="Available once client care confirms the time"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="Styling appointment"
      actionBar={
        <Button
          label="Send enquiry (demo)"
          busy={sending}
          onPress={() => void submit()}
          testID="send-enquiry"
        />
      }
    >
      <View style={styles.steps}>
        <Callout title="Enquiry — not a booking.">
          No booking system is connected, so these times are samples. MAXHOSA client care would
          confirm a real time. Nothing is sent in this demo.
        </Callout>

        <Step n={1} title="Choose a service" error={errors.type}>
          {types.status === 'loading' ? <LoadingSkeleton rows={1} /> : null}
          <View accessibilityRole="radiogroup" style={{ gap: space.s }}>
            {types.data?.map((t) => (
              <PressableScale
                key={t.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: typeId === t.id }}
                onPress={() => {
                  setTypeId(t.id);
                  setDay(null);
                  setSlot(null);
                  setErrors((e) => ({ ...e, type: undefined }));
                }}
                style={[
                  styles.choice,
                  {
                    backgroundColor: colors.card,
                    borderColor: typeId === t.id ? colors.ink : colors.hairline,
                    borderWidth: typeId === t.id ? 2 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={
                    t.format === 'virtual'
                      ? 'videocam-outline'
                      : t.id === 'studio'
                        ? 'storefront-outline'
                        : 'sparkles-outline'
                  }
                  size={20}
                  color={colors.ink}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="callout" weight="600">
                    {t.label}
                  </Text>
                  <Text variant="footnote" color="ink3">
                    {t.format === 'virtual'
                      ? 'Video call'
                      : 'In person · location confirmed by client care'}{' '}
                    · about {t.minutes} min
                  </Text>
                </View>
              </PressableScale>
            ))}
          </View>
        </Step>

        <Step n={2} title="Pick a day and time" error={errors.slot}>
          <Text variant="footnote" color="ink3">
            Sample availability · times in South Africa (SAST)
          </Text>
          {!typeId ? (
            <Text variant="subhead" color="ink3">
              Choose a service first.
            </Text>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.s }}
                accessibilityRole="radiogroup"
              >
                {days.map(([d, s]) => {
                  const open = s.some((x) => x.available);
                  const selected = day === d;
                  return (
                    <PressableScale
                      key={d}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: !open }}
                      accessibilityLabel={`${fmtDay(d, 'long')}${open ? '' : ', closed (sample)'}`}
                      onPress={() => {
                        if (!open) return;
                        setDay(d);
                        setSlot(null);
                      }}
                      style={[
                        styles.day,
                        {
                          backgroundColor: selected ? colors.ink : colors.card,
                          borderColor: colors.hairline,
                          opacity: open ? 1 : 0.4,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        weight="700"
                        style={{ color: selected ? colors.onInk : colors.ink3 }}
                      >
                        {fmtDay(d, 'short').toUpperCase()}
                      </Text>
                      <Text
                        variant="headline"
                        style={{ color: selected ? colors.onInk : colors.ink }}
                      >
                        {Number(d.slice(8, 10))}
                      </Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>
              {day ? (
                <View style={styles.times} accessibilityRole="radiogroup">
                  {days
                    .find(([d]) => d === day)?.[1]
                    .map((s) => (
                      <Chip
                        key={s.id}
                        kind="radio"
                        tall
                        label={s.startsAt.slice(11, 16)}
                        struck={!s.available}
                        selected={slot?.id === s.id}
                        accessibilityLabel={`${s.startsAt.slice(11, 16)}${s.available ? '' : ', taken'}`}
                        onPress={() => {
                          if (!s.available) return;
                          setSlot(s);
                          setErrors((e) => ({ ...e, slot: undefined }));
                        }}
                      />
                    ))}
                </View>
              ) : null}
              {slot && local(slot) ? (
                <Text variant="footnote" color="ink3">
                  That is {local(slot)} where you are.
                </Text>
              ) : null}
            </>
          )}
        </Step>

        <Step n={3} title="Your details">
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
          <Input
            label="Phone (optional)"
            value={form.phone}
            error={errors.phone}
            autoComplete="tel"
            keyboardType="phone-pad"
            onChange={(phone) => setForm((f) => ({ ...f, phone }))}
            onBlur={() => blur('phone')}
          />
          <Input
            label="Anything we should know? (optional)"
            value={form.notes}
            multiline
            onChange={(notes) => setForm((f) => ({ ...f, notes }))}
          />
          <Text variant="footnote" color="ink3">
            Your details are used only to reply to this enquiry. In this demo they stay on the
            device and are not sent.
          </Text>
        </Step>
      </View>
    </Screen>
  );
}

function Step({
  n,
  title,
  error,
  children,
}: {
  n: number;
  title: string;
  error?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.m }}>
      <View style={styles.stepHead}>
        <View style={[styles.num, { backgroundColor: colors.ink }]}>
          <Text variant="caption" weight="700" style={{ color: colors.onInk }}>
            {n}
          </Text>
        </View>
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
      {error ? <ErrorText text={error} /> : null}
    </View>
  );
}

function ErrorText({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.error} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={15} color={colors.rust} />
      <Text variant="footnote" color="rust" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

function Input({
  label,
  value,
  error,
  onChange,
  onBlur,
  multiline,
  autoComplete,
  keyboardType,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  multiline?: boolean;
  autoComplete?: 'name' | 'email' | 'tel';
  keyboardType?: 'email-address' | 'phone-pad';
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="footnote" weight="700" color="ink2">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        multiline={multiline}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        autoCapitalize={autoComplete === 'email' ? 'none' : 'sentences'}
        accessibilityLabel={label}
        accessibilityHint={error}
        style={[
          styles.input,
          multiline && { minHeight: 88, textAlignVertical: 'top' },
          {
            backgroundColor: colors.sunk,
            color: colors.ink,
            borderColor: error ? colors.rust : 'transparent',
          },
        ]}
      />
      {error ? <ErrorText text={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { paddingHorizontal: space.gutter, paddingTop: space.s, gap: space.xxl },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.l,
    borderRadius: radius.m,
  },
  day: {
    width: 58,
    paddingVertical: space.s,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  input: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: space.m,
    fontSize: 16,
    borderWidth: 2,
  },
  error: { flexDirection: 'row', gap: space.xs, alignItems: 'center' },
});
