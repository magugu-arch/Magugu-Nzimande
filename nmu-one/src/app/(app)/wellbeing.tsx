import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { WellbeingService } from '@/core/domain/models';
import { useWellbeingServices } from '@/data/hooks';
import {
  Button,
  Card,
  HeroBack,
  Icon,
  Notice,
  PhotoHero,
  Pill,
  QueryState,
  Row,
  Screen,
  SectionHeader,
  Sheet,
  Text,
  colors,
  spacing,
  type IconName,
} from '@/design';
import { useCan } from '@/features/access/access';

const ICON: Record<WellbeingService['kind'], IconName> = {
  counselling: 'chatbubbles-outline',
  wellness: 'leaf-outline',
  'academic-support': 'school-outline',
  'food-support': 'restaurant-outline',
  crisis: 'call-outline',
  health: 'medkit-outline',
};

/**
 * Wellbeing (brief §13): routes to help, said plainly. Crisis support is
 * first and never behind a menu; everything else is one tap from contact.
 */
export default function Wellbeing() {
  const router = useRouter();
  const services = useWellbeingServices();
  const canBook = useCan('wellbeing.book');
  const [booking, setBooking] = useState<WellbeingService | null>(null);

  return (
    <Screen padded={false} topInset={false} testID="wellbeing">
      <PhotoHero
        photo="wellbeing"
        eyebrow="Wellbeing & support"
        title="Support, whenever you need it."
        subtitle="Free, confidential support for whatever you’re carrying."
        height={300}
        topBar={<HeroBack />}
      />
      <View style={styles.body}>
        <Card tone="navy" testID="crisis-card">
          <Text variant="overline" color={colors.yellow}>
            If you’re in crisis
          </Text>
          <Text variant="title3" color={colors.white}>
            You don’t have to wait for an appointment.
          </Text>
          <Text variant="body" color={colors.textOnDarkMuted}>
            SADAG Suicide Crisis Helpline: 0800 567 567, free, 24 hours. In immediate danger, call
            112.
          </Text>
          <Row gap={spacing.sm} style={{ marginTop: spacing.md }} wrap>
            <Button
              label="Call 0800 567 567"
              icon="call"
              variant="accent"
              size="md"
              onPress={() => void Linking.openURL('tel:0800567567')}
            />
            <Button
              label="Safety"
              variant="onDark"
              size="md"
              onPress={() => router.push('/safety')}
            />
          </Row>
        </Card>

        <QueryState query={services} what="wellbeing services">
          {(list) => (
            <View>
              <SectionHeader title="Support on campus" />
              <View style={{ gap: spacing.md }}>
                {list
                  .filter((s) => s.kind !== 'crisis')
                  .map((s) => (
                    <Card key={s.id} testID={`wellbeing-${s.id}`}>
                      <Row gap={spacing.md} align="flex-start">
                        <View style={styles.icon}>
                          <Icon name={ICON[s.kind]} size={20} color={colors.navy} />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text variant="label">{s.name}</Text>
                          <Text variant="caption" color={colors.textSecondary}>
                            {s.description}
                          </Text>
                          <Text variant="caption" color={colors.textSecondary}>
                            {s.hours}
                          </Text>
                          {s.bookable && canBook ? (
                            <Button
                              label="Request an appointment"
                              variant="secondary"
                              size="md"
                              onPress={() => setBooking(s)}
                              style={{ marginTop: spacing.sm }}
                            />
                          ) : s.access === 'walk-in' ? (
                            <View style={{ marginTop: spacing.xs }}>
                              <Pill label="Walk in" tone="info" />
                            </View>
                          ) : s.kind === 'wellness' ? (
                            <Button
                              label="See sessions in Events"
                              variant="ghost"
                              size="md"
                              onPress={() => router.push('/events')}
                            />
                          ) : null}
                        </View>
                      </Row>
                    </Card>
                  ))}
              </View>
            </View>
          )}
        </QueryState>
        <Text variant="caption" color={colors.textSecondary}>
          What you share with a counsellor stays with them. NMU ONE doesn’t see or store it.
        </Text>
      </View>

      <Sheet
        visible={!!booking}
        onClose={() => setBooking(null)}
        title={booking ? `Request ${booking.name}` : ''}
      >
        <Notice
          tone="info"
          title="Appointment booking connects later"
          body="In the live service this opens the wellbeing team’s own booking system, so your request goes straight to them and is never stored in NMU ONE. For now, visit the Health & Wellness Centre or call the crisis line above any time."
        />
        <Button
          label="Directions to the centre"
          icon="navigate"
          variant="primary"
          fullWidth
          onPress={() => {
            setBooking(null);
            router.push('/campus-map?to=HW');
          }}
        />
        <Button label="Close" variant="ghost" fullWidth onPress={() => setBooking(null)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.gutter, gap: spacing.xl },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
