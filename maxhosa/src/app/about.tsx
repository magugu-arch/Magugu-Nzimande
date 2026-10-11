import { View } from 'react-native';
import { DEMO_LINE } from '@/components/DemoBanner';
import { Group, Row } from '@/components/List';
import { SheetScaffold } from '@/components/SheetScaffold';
import { Text } from '@/components/Text';
import { space } from '@/design/tokens';
import { providers } from '@/providers';

const ROWS: [string, string][] = [
  [
    'Images',
    'The 24 verified concept assets, plus one client-supplied event photograph — not approved product photography or live SKUs',
  ],
  ['Products, prices, sizes, stock', 'Invented sample data, labelled throughout'],
  ['Checkout', 'Simulated; no payment form, no order leaves this device'],
  ['Delivery tracking', 'Simulated courier, timeline and map — "Demo location, not GPS"'],
  ['Appointments', 'Enquiries only, sample times, nothing is sent'],
  ['Events', 'Sample fixtures; RSVPs stay in the app, nothing is sent and no place is held'],
  ['Stories', 'Placeholder copy until MAXHOSA approves the text'],
  [
    'Wordmark and type',
    'Typeset placeholder and provisional tokens until the brand guidelines arrive',
  ],
];

export default function About() {
  return (
    <SheetScaffold title="What is real here">
      <Text variant="callout" style={{ marginBottom: space.l }}>
        {DEMO_LINE}.
      </Text>
      <View style={{ marginHorizontal: -space.gutter }}>
        <Group>
          {ROWS.map(([title, sub], i) => (
            <Row key={title} first={i === 0} title={title} subtitle={sub} />
          ))}
          <Row
            title="Adapters in use"
            subtitle={`Commerce: ${providers.commerce.id} · Delivery: ${providers.delivery.id} · Booking: ${providers.booking.id}`}
          />
        </Group>
      </View>
      <Text variant="footnote" color="ink3" style={{ marginTop: space.l }}>
        Motion follows Apple’s fluid-interface principles: sheets and screens follow your finger,
        keep your speed when you let go, and can be caught mid-way. Reduce Motion swaps slides for
        cross-fades.
      </Text>
    </SheetScaffold>
  );
}
