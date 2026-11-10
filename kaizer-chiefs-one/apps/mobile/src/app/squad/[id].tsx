import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BackHeader, DemoTag, EmptyState, Group, ListRow, Screen, Text } from '@/components';
import { findDemoPlayer } from '@/data/demo/football';
import { color, radius, space } from '@/theme';

/**
 * Player profile shell. In demo mode this shows where approved material will
 * sit (headshot, number, biography, stats) without inventing any of it.
 */
export default function PlayerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const player = findDemoPlayer(id);
  if (!player) {
    return (
      <Screen topInset={false} header={<BackHeader title="Player" />}>
        <EmptyState
          icon="person-outline"
          title="Profile not available"
          body="This profile is not published."
        />
      </Screen>
    );
  }
  return (
    <Screen topInset={false} header={<BackHeader title="Player profile" />}>
      <View style={{ gap: space.xl }}>
        <View style={styles.hero}>
          <Ionicons name="person" size={120} color={color.surfaceHigh} />
          <View style={styles.tag}>
            <DemoTag kind="SAMPLE" />
          </View>
        </View>
        <View style={{ gap: space.xs }}>
          <Text variant="micro" color="accent">
            {player.position}
          </Text>
          <Text variant="display">{player.displayName}</Text>
          <Text variant="body" color="textSecondary">
            Placeholder profile. The headshot, name, shirt number and biography are published by the
            club from its approved roster, with the player’s consent.
          </Text>
        </View>
        <Group>
          <ListRow
            title="Shirt number"
            value={player.shirtNumber ? String(player.shirtNumber) : 'Pending'}
          />
          <ListRow title="Biography" value={player.bio ? 'Published' : 'Pending approved copy'} />
          <ListRow title="Season statistics" value="From match data provider" />
        </Group>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 260,
    borderRadius: radius.lg,
    backgroundColor: color.bgRaised,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  tag: { position: 'absolute', top: space.md, left: space.md },
});
