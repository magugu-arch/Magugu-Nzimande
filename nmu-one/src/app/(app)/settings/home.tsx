import { View } from 'react-native';
import {
  MODULE_LABELS,
  PINNED,
  ROLE_DEFAULTS,
  moveModule,
  type HomeLayout,
  type HomeModuleId,
} from '@/core/home/composeHome';
import {
  Button,
  Card,
  Divider,
  Header,
  IconButton,
  Row,
  Screen,
  Text,
  Toggle,
  colors,
  spacing,
} from '@/design';
import { preferences, usePrefs } from '@/state/preferences';
import { useSession } from '@/state/session';

/** Reorder or hide Home modules (brief §5 "personalised modules can be reordered or hidden"). */
export default function EditHome() {
  const user = useSession((s) => s.user);
  const role = useSession((s) => s.role);
  const prefs = usePrefs(user?.id);
  if (!user || !role) return null;

  const defaults = ROLE_DEFAULTS[role];
  const saved = prefs.homeLayouts[role];
  const layout: HomeLayout = {
    order: [
      ...(saved?.order ?? []).filter((id) => defaults.includes(id)),
      ...defaults.filter((id) => !(saved?.order ?? []).includes(id)),
    ],
    hidden: saved?.hidden ?? [],
  };
  const save = (next: HomeLayout) => preferences.setHomeLayout(user.id, role, next);
  const toggle = (id: HomeModuleId, show: boolean) =>
    save({
      ...layout,
      hidden: show ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id],
    });

  return (
    <Screen
      header={
        <Header
          title="Edit Home"
          largeTitle="Edit Home"
          eyebrow="Settings"
          subtitle="Choose what you see first. Some cards only appear when they’re relevant."
          fallbackHref="/home"
        />
      }
      testID="edit-home-screen"
    >
      <Card>
        {layout.order.map((id, i) => (
          <View key={id}>
            {i > 0 ? <Divider /> : null}
            <Row gap={spacing.xs}>
              <View style={{ flex: 1 }}>
                {PINNED.has(id) ? (
                  <View style={{ paddingVertical: spacing.sm }}>
                    <Text variant="label">{MODULE_LABELS[id]}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      Always shown when there’s something important
                    </Text>
                  </View>
                ) : (
                  <Toggle
                    label={MODULE_LABELS[id]}
                    value={!layout.hidden.includes(id)}
                    onChange={(show) => toggle(id, show)}
                    testID={`toggle-${id}`}
                  />
                )}
              </View>
              <IconButton
                icon="arrow-up"
                label={`Move ${MODULE_LABELS[id]} up`}
                onPress={() => save({ ...layout, order: moveModule(layout.order, id, -1) })}
              />
              <IconButton
                icon="arrow-down"
                label={`Move ${MODULE_LABELS[id]} down`}
                onPress={() => save({ ...layout, order: moveModule(layout.order, id, 1) })}
              />
            </Row>
          </View>
        ))}
      </Card>
      <Button
        label="Reset to default"
        variant="ghost"
        onPress={() => preferences.resetHomeLayout(user.id, role)}
        style={{ marginTop: spacing.lg, alignSelf: 'center' }}
      />
    </Screen>
  );
}
