import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { NATIONAL_EMERGENCY } from '@/content/emergency';
import { providers } from '@/core/adapters/registry';
import type { LocationShare, SafetyContact } from '@/core/domain/models';
import { formatCountdown, formatTime } from '@/core/time/sast';
import { useSafetyContacts } from '@/data/hooks';
import {
  Button,
  Card,
  Header,
  Icon,
  ListRow,
  Notice,
  Pill,
  SkeletonCard,
  Row,
  Screen,
  SectionHeader,
  Segmented,
  Sheet,
  Text,
  Touchable,
  colors,
  radius,
  spacing,
} from '@/design';
import { useCan } from '@/features/access/access';
import { useNow } from '@/features/system/useNow';
import { recordAudit, useGovernance } from '@/state/governance';
import { useSession } from '@/state/session';

const call = (phone: string) => void Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);

/**
 * Safety (brief §13) — an operational product, not decoration. No motion,
 * no clever layout: the emergency action is first, large and one tap; the
 * numbers are bundled so they work with no signal; location sharing needs
 * explicit consent, has a time limit, and can be stopped at any moment.
 */
export default function Safety() {
  const router = useRouter();
  const now = useNow(15_000);
  const user = useSession((s) => s.user);
  const contacts = useSafetyContacts();
  const canShare = useCan('safety.share-location');
  const recordConsent = useGovernance((s) => s.recordConsent);
  const [consentOpen, setConsentOpen] = useState(false);
  const [minutes, setMinutes] = useState<'30' | '60'>('30');
  const [share, setShare] = useState<LocationShare | null>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'denied' | 'failed' | 'stopping'>(
    'idle',
  );

  // A share ends itself at its expiry; past that it is simply not shown.
  const active = share && new Date(share.expiresAt) > now ? share : null;

  const start = async () => {
    setState('starting');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState('denied');
        return;
      }
      recordConsent('location-sharing', true);
      const s = await providers.support.startLocationShare({ minutes: Number(minutes) });
      if (user)
        recordAudit(
          'safety.location-share.start',
          user.id,
          `Shared with ${s.recipient} for ${minutes} min`,
        );
      setShare(s);
      setConsentOpen(false);
      setState('idle');
    } catch {
      setState('failed');
    }
  };

  const stop = async () => {
    if (!active) return;
    setState('stopping');
    try {
      await providers.support.stopLocationShare(active.id);
    } catch {
      // Stopping must always succeed locally; the BFF reconciles on reconnect.
    }
    recordConsent('location-sharing', false);
    if (user) recordAudit('safety.location-share.stop', user.id, 'Stopped sharing location');
    setShare(null);
    setState('idle');
  };

  const national = (list: SafetyContact[]) => list.filter((c) => c.scope === 'national');
  const campus = (list: SafetyContact[]) => list.filter((c) => c.scope === 'campus');

  return (
    <Screen header={<Header title="Safety" />} testID="safety">
      <Touchable
        onPress={() => call('10111')}
        accessibilityRole="button"
        accessibilityLabel="Emergency. Call SAPS on 1 0 1 1 1"
        accessibilityHint="Starts a phone call"
        style={styles.sos}
        testID="call-emergency"
      >
        <View style={styles.sosIcon}>
          <Icon name="call" size={28} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title2" color={colors.white}>
            Emergency: call 10111
          </Text>
          <Text variant="body" color={colors.white}>
            Or 112 from any mobile. Works without data.
          </Text>
        </View>
      </Touchable>

      <View style={styles.section}>
        <SectionHeader title="Share my location" />
        {active ? (
          <Card tone="navy" testID="location-sharing-active">
            <Row gap={spacing.sm}>
              <Pill label="Sharing now" tone="yellow" icon="radio-outline" />
            </Row>
            <Text variant="title3" color={colors.white} style={{ marginTop: spacing.sm }}>
              {active.recipient} can see where you are
            </Text>
            <Text variant="body" color={colors.textOnDarkMuted}>
              Started {formatTime(active.startedAt)} · stops automatically{' '}
              {formatCountdown(active.expiresAt, now)}
            </Text>
            <Button
              label="Stop sharing now"
              icon="stop-circle"
              variant="onDark"
              fullWidth
              loading={state === 'stopping'}
              onPress={stop}
              style={{ marginTop: spacing.lg }}
              testID="stop-sharing"
            />
          </Card>
        ) : canShare ? (
          <Card>
            <Text variant="body">
              Walking alone or late? Share your live location with Campus Protection for a set time.
              Only while you choose; you can stop at any moment.
            </Text>
            <Button
              label="Share my location"
              icon="navigate-circle"
              variant="primary"
              fullWidth
              onPress={() => setConsentOpen(true)}
              style={{ marginTop: spacing.md }}
              testID="share-location"
            />
          </Card>
        ) : (
          <Notice
            tone="neutral"
            title="Not available for your role"
            body="Location sharing is available to students and staff on campus."
          />
        )}
        {state === 'denied' ? (
          <Notice
            tone="warning"
            title="Location permission is off"
            body="NMU ONE can’t share your location without it. You can still call for help using the numbers on this page."
          />
        ) : null}
        {state === 'failed' ? (
          <Notice
            tone="danger"
            title="Couldn’t start sharing"
            body="Nothing was shared. Call 10111 if you need help now."
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Emergency numbers" />
        <Card padded={false} style={styles.list}>
          {national(contacts.data ?? NATIONAL_EMERGENCY).map((c) => (
            <ListRow
              key={c.id}
              icon="call-outline"
              iconTone="danger"
              title={`${c.name} · ${c.phone}`}
              subtitle={`${c.description} ${c.availability}.`}
              onPress={() => call(c.phone!)}
              accessibilityLabel={`Call ${c.name}, ${c.phone}`}
            />
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Campus Protection" />
        {contacts.data ? (
          <Card padded={false} style={styles.list}>
            {campus(contacts.data).map((c) =>
              c.verified && c.phone ? (
                <ListRow
                  key={c.id}
                  icon="shield-checkmark-outline"
                  title={c.name}
                  subtitle={`${c.phone} · ${c.availability}`}
                  onPress={() => call(c.phone!)}
                />
              ) : (
                <ListRow
                  key={c.id}
                  icon="shield-checkmark-outline"
                  title={c.name}
                  subtitle="Number to be confirmed by NMU Protection Services"
                  trailing={<Pill label="Pending" />}
                />
              ),
            )}
          </Card>
        ) : contacts.status === 'loading' ? (
          <SkeletonCard lines={2} />
        ) : (
          <Notice
            tone="neutral"
            title="Campus contacts unavailable offline"
            body="The national numbers above always work. Campus numbers load when you’re back online."
          />
        )}
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
          Campus numbers appear here once Protection Services confirms them, and are then kept on
          your phone so they show without signal.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Getting home safely" />
        <Card padded={false} style={styles.list}>
          <ListRow
            icon="bus-outline"
            title="Late-night shuttle"
            subtitle="Route N to the residences from 18:00"
            onPress={() => router.push('/transport/route-n')}
          />
          <ListRow
            icon="heart-outline"
            title="Need to talk to someone?"
            subtitle="Counselling and crisis support"
            onPress={() => router.push('/wellbeing')}
          />
        </Card>
      </View>

      <Sheet
        visible={consentOpen}
        onClose={() => setConsentOpen(false)}
        title="Share your location?"
        testID="location-consent"
      >
        <Text variant="body">
          Campus Protection Services will see your live location until the time runs out or you
          stop. It isn’t used for anything else, and you can stop at any moment.
        </Text>
        <Segmented<'30' | '60'>
          label="How long"
          value={minutes}
          onChange={setMinutes}
          options={[
            { value: '30', label: '30 minutes' },
            { value: '60', label: '1 hour' },
          ]}
        />
        <Text variant="caption" color={colors.textSecondary}>
          Your choice is recorded so you can review it under Profile → Privacy.
        </Text>
        <Button
          label={`Share for ${minutes === '30' ? '30 minutes' : '1 hour'}`}
          variant="primary"
          fullWidth
          loading={state === 'starting'}
          onPress={start}
          testID="confirm-share"
        />
        <Button label="Cancel" variant="ghost" fullWidth onPress={() => setConsentOpen(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.danger,
    minHeight: 96,
  },
  sosIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.lg },
});
