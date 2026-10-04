import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SERVICES, WORLDS } from '@/content/services';
import { decide } from '@/core/permissions/policy';
import {
  Card,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  SkeletonCard,
  Text,
  Touchable,
  colors,
  radius,
  spacing,
} from '@/design';
import { useSubject } from '@/features/access/access';

/**
 * Every service, organised by the five product worlds (brief §4) — not by
 * department — and only the ones this person can use.
 */
export default function Services() {
  const router = useRouter();
  const subject = useSubject();

  return (
    <Screen testID="services">
      <Text variant="overline" color={colors.textSecondary}>
        Everything in one place
      </Text>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        Services
      </Text>
      <Touchable
        onPress={() => router.push('/search')}
        accessibilityRole="search"
        accessibilityLabel="Search services, places and people"
        style={styles.search}
      >
        <Icon name="search" size={20} color={colors.textSecondary} />
        <Text variant="body" color={colors.textSecondary}>
          Search services, places and people
        </Text>
      </Touchable>

      {!subject ? (
        <SkeletonCard lines={5} />
      ) : (
        WORLDS.map((world) => {
          const items = SERVICES.filter(
            (s) => s.world === world.id && decide(subject, s.capability).allowed,
          );
          if (items.length === 0) return null;
          return (
            <View key={world.id} style={styles.world} testID={`world-${world.id}`}>
              <SectionHeader title={world.title} />
              <Card padded={false} style={styles.card}>
                {items.map((s) => (
                  <ListRow
                    key={s.id}
                    icon={s.icon}
                    iconTone="yellow"
                    title={s.title}
                    subtitle={s.summary}
                    onPress={() => router.push(s.href)}
                    testID={`service-${s.id}`}
                  />
                ))}
              </Card>
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.lg },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  world: { marginBottom: spacing.xl },
  card: { paddingHorizontal: spacing.lg },
});
