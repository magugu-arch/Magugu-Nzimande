import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { Wordmark } from '@/components/brand/Wordmark';
import { ReservationRow } from '@/components/mabu/Cards';
import {
  Card,
  ListRow,
  Photo,
  PremiumButton,
  Screen,
  SectionTitle,
  Skeleton,
  Text,
} from '@/components/ui';
import { formatPoints } from '@/domain/shared/format';
import { useRpc } from '@/services/queries';
import { isStaff, useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme';

/** §16 Profile — "Your Mábu Journey". */
export default function Profile() {
  const session = useSession();
  const client = useQueryClient();
  const signedIn = !!session.actor;
  const me = useRpc('me.get', undefined, { enabled: signedIn });
  const bookings = useRpc('booking.mine', undefined, { enabled: signedIn });
  const wallet = useRpc('rewards.wallet', undefined, { enabled: signedIn });
  const inbox = useRpc('notifications.inbox', undefined, { enabled: signedIn });
  const programme = useRpc('rewards.programme', undefined, { enabled: !signedIn });

  if (!signedIn) {
    return (
      <Screen padded={false}>
        <View style={styles.guestHero}>
          <Photo photo="bar-lounge" label="" style={StyleSheet.absoluteFill} scrim="bottom" />
          <View style={{ alignItems: 'center', gap: spacing.lg }}>
            <Wordmark size={44} />
          </View>
        </View>
        <View style={styles.pad}>
          <Text variant="h1" align="center" accessibilityRole="header">
            Your Mábu Journey
          </Text>
          <Text variant="body" color="textMuted" align="center" style={{ marginTop: spacing.sm }}>
            Manage your bookings, keep your vouchers, save favourites and join MÁBU Rewards —
            privileges built around visits and experiences.
          </Text>
          <PremiumButton
            label="Sign in or join"
            style={{ marginTop: spacing.xl }}
            onPress={() => router.push('/sign-in')}
            testID="profile-signin"
          />
          {programme.data ? (
            <>
              <SectionTitle eyebrow="MÁBU Rewards" title="Tiers of recognition" />
              {programme.data.tiers.map((t) => (
                <Card key={t.id} style={{ marginBottom: spacing.md, gap: spacing.xs }}>
                  <Text variant="h3" color="accent">
                    {t.name}
                  </Text>
                  <Text variant="bodySmall" color="textMuted">
                    {t.benefits.join(' · ')}
                  </Text>
                </Card>
              ))}
            </>
          ) : null}
          <SectionTitle title="Visit & help" />
          <ListRow
            icon={<BrandIcon name="location" size={22} />}
            label="Find your way to Mábu"
            onPress={() => router.push('/visit')}
          />
          <ListRow
            icon={<BrandIcon name="contact" size={22} />}
            label="Contact & help"
            onPress={() => router.push('/support')}
          />
          <ListRow
            icon={<Feather name="shield" size={20} color={colors.accent} />}
            label="Privacy notice"
            onPress={() => router.push('/legal/privacy')}
          />
        </View>
      </Screen>
    );
  }

  const next = bookings.data?.upcoming[0];
  const account = wallet.data?.account;

  return (
    <Screen meta={{ title: 'Your profile', noindex: true }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="eyebrow" color="accent">
            Your Mábu Journey
          </Text>
          <Text variant="h1" accessibilityRole="header">
            {me.data?.name ? `Welcome, ${me.data.name.split(' ')[0]}` : 'Welcome'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={`Notifications${inbox.data?.unread ? `, ${inbox.data.unread} unread` : ''}`}
          style={styles.bell}
        >
          <Feather name="bell" size={20} color={colors.text} />
          {inbox.data?.unread ? <View style={styles.bellDot} /> : null}
        </Pressable>
      </View>

      {/* Rewards card */}
      <Pressable
        onPress={() => router.push('/rewards')}
        accessibilityRole="button"
        accessibilityLabel={
          account
            ? `MÁBU Rewards, ${wallet.data?.progress?.current.name}, ${account.balancePoints} points`
            : 'Join MÁBU Rewards'
        }
        style={styles.rewards}
      >
        <Photo photo="texture-timber" label="" style={StyleSheet.absoluteFill} scrim="full" />
        <View style={{ padding: spacing.xl, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <BrandIcon name="rewards" size={22} />
            <Text variant="eyebrow" color="accent">
              MÁBU Rewards
            </Text>
          </View>
          {wallet.isPending ? (
            <Skeleton height={40} width="60%" />
          ) : account && wallet.data?.progress ? (
            <>
              <Text variant="h1">{wallet.data.progress.current.name}</Text>
              <Text variant="body">{formatPoints(account.balancePoints)} points</Text>
              {wallet.data.progress.next ? (
                <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${Math.round(wallet.data.progress.fraction * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text variant="caption" color="textMuted">
                    {formatPoints(wallet.data.progress.pointsToNext)} to{' '}
                    {wallet.data.progress.next.name}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text variant="h2">Join MÁBU Rewards</Text>
              <Text variant="bodySmall" color="textMuted">
                Earn with every visit and experience. Privileges, not discounts.
              </Text>
            </>
          )}
        </View>
      </Pressable>

      {next ? (
        <>
          <SectionTitle eyebrow="Next visit" title="Your table" />
          <ReservationRow reservation={next} />
        </>
      ) : bookings.isSuccess ? (
        <Card style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Text variant="h3">No upcoming table</Text>
          <PremiumButton label="Book your table" onPress={() => router.navigate('/book')} />
        </Card>
      ) : null}

      <SectionTitle title="Your account" />
      <ListRow
        icon={<BrandIcon name="reservations" size={22} />}
        label="My bookings & events"
        onPress={() => router.push('/profile/bookings')}
      />
      <ListRow
        icon={<BrandIcon name="vouchers" size={22} />}
        label="My vouchers"
        onPress={() => router.push('/profile/vouchers')}
      />
      <ListRow
        icon={<Feather name="heart" size={20} color={colors.accent} />}
        label="Favourites"
        onPress={() => router.push('/profile/favourites')}
      />
      <ListRow
        icon={<BrandIcon name="profile" size={22} />}
        label="Details, preferences & occasions"
        onPress={() => router.push('/profile/details')}
      />
      <ListRow
        icon={<Feather name="bell" size={20} color={colors.accent} />}
        label="Notifications"
        value={inbox.data?.unread ? `${inbox.data.unread} new` : undefined}
        onPress={() => router.push('/notifications')}
      />
      <ListRow
        icon={<Feather name="sliders" size={20} color={colors.accent} />}
        label="Notification preferences"
        onPress={() => router.push('/notifications/preferences')}
      />

      <SectionTitle title="Visit & help" />
      <ListRow
        icon={<BrandIcon name="location" size={22} />}
        label="Find your way to Mábu"
        onPress={() => router.push('/visit')}
      />
      <ListRow
        icon={<BrandIcon name="contact" size={22} />}
        label="Contact & help"
        onPress={() => router.push('/support')}
      />
      <ListRow
        icon={<Feather name="smartphone" size={20} color={colors.accent} />}
        label="Sign-ins and devices"
        onPress={() => router.push('/profile/security')}
      />
      <ListRow
        icon={<Feather name="shield" size={20} color={colors.accent} />}
        label="Privacy notice"
        onPress={() => router.push('/legal/privacy')}
      />
      <ListRow
        icon={<Feather name="file-text" size={20} color={colors.accent} />}
        label="Terms of use"
        onPress={() => router.push('/legal/terms')}
      />

      {isStaff(session.actor) ? (
        <>
          <SectionTitle title="Restaurant" />
          <ListRow
            icon={<Feather name="briefcase" size={20} color={colors.accent} />}
            label="Staff & admin"
            onPress={() => router.push('/admin')}
          />
        </>
      ) : null}

      <View style={{ marginTop: spacing.xxl }}>
        <PremiumButton
          label="Sign out"
          variant="ghost"
          onPress={() => {
            session.signOut();
            client.clear();
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.gutter, marginTop: spacing.xl },
  guestHero: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
  header: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.xl, gap: spacing.md },
  bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  rewards: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  track: { height: 3, backgroundColor: colors.borderStrong, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: colors.accent },
});
