import { StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { MAX_AGE_MS } from '@kc-one/contracts';
import {
  BackHeader,
  Button,
  ConceptImage,
  DemoTag,
  Eyebrow,
  Headline,
  LoadingBlock,
  Notice,
  ProvenanceLine,
  QueryState,
  Screen,
  Text,
} from '@/components';
import { backend, capabilities } from '@/config/env';
import { isImageKey } from '@/config/imagery';
import { useProducts } from '@/data/queries';
import { color, radius, space } from '@/theme';

/**
 * Product discovery with a hand-off to the official store. No basket and no
 * checkout here: those stay with the commerce provider until the club approves
 * an in-app checkout and its payment and support ownership.
 */
export default function Shop() {
  const q = useProducts();
  const storeLive = capabilities.commerce === 'live' && !!backend.shopUrl;
  return (
    <Screen topInset={false} header={<BackHeader title="Shop" />}>
      <View style={{ gap: space.xl }}>
        <ConceptImage imageKey="merchandise" style={styles.hero} position="top" />
        <Eyebrow>Official store</Eyebrow>
        <Headline lead="Wear the" accent="gold." size="display" />
        <QueryState query={q} loading={<LoadingBlock lines={2} />}>
          {(products, provenance) => (
            <View style={{ gap: space.md }}>
              <View style={styles.grid}>
                {products.map((p) => (
                  <View
                    key={p.id}
                    style={styles.card}
                    accessible
                    accessibilityLabel={`${p.name}${p.priceText ? `, ${p.priceText}` : ''}`}
                  >
                    <View style={styles.thumb}>
                      {isImageKey(p.imageKey) ? (
                        <ConceptImage
                          imageKey={p.imageKey}
                          style={StyleSheet.absoluteFill}
                          decorative
                          tag="none"
                        />
                      ) : null}
                    </View>
                    <View style={{ padding: space.md, gap: space.xs }}>
                      <Text variant="headline" numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text variant="footnote" color="textTertiary">
                        {p.priceText ?? 'Price at official store'}
                      </Text>
                      {p.provenance.state === 'demo' ? <DemoTag kind="SAMPLE" /> : null}
                    </View>
                  </View>
                ))}
              </View>
              <ProvenanceLine
                provenance={provenance}
                maxAgeMs={MAX_AGE_MS.content}
                sourceLabel="Official store"
              />
            </View>
          )}
        </QueryState>
        {storeLive ? (
          <Button
            label="Open the official store"
            icon="open-outline"
            onPress={() => void WebBrowser.openBrowserAsync(backend.shopUrl!)}
          />
        ) : (
          <Notice
            compact
            reason="integration_pending"
            title="Store link not connected"
            body="Shopping opens in the club’s official store once its address is confirmed. The app does not take payments."
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 240, borderRadius: radius.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: {
    width: '48.8%',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  thumb: { height: 120, backgroundColor: color.bgRaised },
});
