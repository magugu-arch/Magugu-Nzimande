import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { Chip } from '@/components/Chip';
import { PressableScale } from '@/components/PressableScale';
import { SheetScaffold } from '@/components/SheetScaffold';
import { Text } from '@/components/Text';
import { toast } from '@/components/Toast';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import catalogue from '@data/sample-catalogue.json';
import { usePrefs } from '@/store/prefs';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

/** Market and currency, or (with ?section=sizes) the optional size profile. */
export default function MarketSheet() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { colors } = useTheme();
  const market = usePrefs((s) => s.market);
  const setMarket = usePrefs((s) => s.setMarket);
  const sizes = usePrefs((s) => s.sizes);
  const toggleSize = usePrefs((s) => s.toggleSize);

  if (section === 'sizes') {
    return (
      <SheetScaffold title="Sizes and preferences">
        <Text variant="callout" color="ink2">
          Optional. Your sizes are marked on product pages so they are easy to spot — they are never
          chosen for you.
        </Text>
        <View style={styles.chips}>
          {SIZES.map((s) => (
            <Chip
              key={s}
              label={s}
              selected={sizes.includes(s)}
              onPress={() => toggleSize(s)}
              tall
            />
          ))}
        </View>
        <Text variant="footnote" color="ink3">
          No body measurements are collected. In this demo, this stays on the device.
        </Text>
      </SheetScaffold>
    );
  }

  return (
    <SheetScaffold title="Market and currency">
      <View style={{ gap: space.s }} accessibilityRole="radiogroup">
        {catalogue.markets.map((m) => {
          const selected = market === m.id;
          return (
            <PressableScale
              key={m.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => {
                setMarket(m.id);
                toast({
                  message: `Showing sample prices for ${m.label}`,
                  icon: 'globe-outline',
                  offset: 'none',
                });
              }}
              style={[
                styles.choice,
                {
                  backgroundColor: colors.card,
                  borderColor: selected ? colors.ink : colors.hairline,
                  borderWidth: selected ? 2 : 1,
                },
              ]}
            >
              <Ionicons name="globe-outline" size={20} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text variant="callout" weight="600">
                  {m.label}
                </Text>
                <Text variant="footnote" color="ink3">
                  {m.currencyCode} · sample prices
                </Text>
              </View>
              {selected ? <Ionicons name="checkmark" size={20} color={colors.ink} /> : null}
            </PressableScale>
          );
        })}
      </View>
      <Text variant="footnote" color="ink3" style={{ marginTop: space.l }}>
        Prices switch to that market’s sample price list — they are not converted on the device.
        Delivery, duties and taxes come from checkout for the address you use, never from a guess.
      </Text>
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginVertical: space.l },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.l,
    borderRadius: radius.m,
  },
});
