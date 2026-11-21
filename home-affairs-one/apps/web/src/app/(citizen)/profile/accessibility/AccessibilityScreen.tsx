'use client';

import { announce, type TextSize } from '@hao/accessibility';
import {
  Card,
  Container,
  Divider,
  Notice,
  PageHeader,
  RadioGroup,
  Section,
  Stack,
  Switch,
  Tag,
} from '@hao/design-system';
import { Languages, LifeBuoy, MapPinned } from 'lucide-react';
import { Row, Rows } from '@/components/cards';
import { Photo } from '@/components/Photo';
import { usePrefs } from '@/lib/prefs';
import { useSession } from '@/lib/session';
import styles from '../profile.module.css';

const TEXT_SIZES: Array<{ value: TextSize; label: string; hint: string }> = [
  { value: 'standard', label: 'Standard', hint: 'The size the service was designed at.' },
  { value: 'large', label: 'Large', hint: 'A little bigger everywhere.' },
  { value: 'larger', label: 'Larger', hint: 'The biggest size. Pages get longer, never wider.' },
];

function isTextSize(value: string): value is TextSize {
  return TEXT_SIZES.some((size) => size.value === value);
}

export function AccessibilityScreen() {
  const { prefs, setPrefs } = usePrefs();
  const { session } = useSession();
  const signedIn = session?.role === 'citizen';

  const chooseTextSize = (value: string) => {
    if (!isTextSize(value)) return;
    setPrefs({ textSize: value });
    const label = TEXT_SIZES.find((size) => size.value === value)?.label ?? value;
    announce(`Text size set to ${label.toLowerCase()}.`);
  };

  return (
    <Container>
      <div className={styles.headSplit}>
        <PageHeader
          eyebrow="Settings"
          title="Accessibility and data"
          lede="Make the service easier to read and lighter to load. Every change applies straight away and is remembered on this device."
          back={
            signedIn ? { href: '/profile/', label: 'Profile' } : { href: '/more/', label: 'More' }
          }
        />
        <Photo
          asset="A04"
          ratio="4 / 5"
          shape="arch"
          className={styles.headPhoto}
          sizes="(min-width: 48rem) 17rem, 12rem"
        />
      </div>

      <Stack gap={7}>
        <Section title="Reading and display" id="display">
          <Card>
            <div className={styles.settings}>
              <RadioGroup
                legend="Text size"
                hint="Changes the size of all text, buttons and forms."
                name="text-size"
                value={prefs.textSize}
                onChange={chooseTextSize}
                options={TEXT_SIZES}
              />
              <div className={styles.sample}>
                <p>
                  <strong>This is how text looks at this size.</strong>
                </p>
                <p>
                  Apply, track and get help in one secure place — on your phone, on the web, or
                  with a person beside you.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className={styles.settings}>
              <Switch
                label="Higher contrast"
                hint="Makes text and borders darker. If your device already asks for more contrast, that is always respected too."
                checked={prefs.contrast === 'more'}
                onChange={(on) => {
                  setPrefs({ contrast: on ? 'more' : 'system' });
                  announce(on ? 'Higher contrast is on.' : 'Higher contrast is off.');
                }}
              />
              <Divider />
              <Switch
                label="Reduce motion"
                hint="Stops animations and transitions. If your device already asks for less motion, that is always respected too."
                checked={prefs.motion === 'reduce'}
                onChange={(on) => {
                  setPrefs({ motion: on ? 'reduce' : 'system' });
                  announce(on ? 'Reduce motion is on.' : 'Reduce motion is off.');
                }}
              />
            </div>
          </Card>
        </Section>

        <Section title="Data" id="data">
          <Card>
            <div className={styles.saver}>
              <div className={styles.settings}>
                <Switch
                  label="Use less data"
                  hint="Loads the smallest version of every photograph."
                  checked={prefs.dataSaver}
                  onChange={(on) => {
                    setPrefs({ dataSaver: on });
                    announce(on ? 'Use less data is on.' : 'Use less data is off.');
                  }}
                />
                <p className={styles.small}>
                  Useful on a slow or costly connection. Words, forms and your applications work
                  exactly the same; only the photographs get lighter.
                </p>
              </div>
              <Photo asset="A08" ratio="3 / 2" shape="soft" sizes="13rem" />
            </div>
          </Card>
        </Section>

        <Section title="Language" id="language">
          <Card tone="sunken">
            <Stack gap={3}>
              <div>
                <Tag tone="attention" icon={<Languages aria-hidden="true" />}>
                  Open decision
                </Tag>
              </div>
              <p>
                <strong>English is available in this prototype.</strong>
              </p>
              <p>
                People should be able to use this service in South Africa’s other official
                languages. Those translations need to be written and reviewed by professionals, so
                they are not machine-translated here — a wrong word in an identity service can do
                real harm.
              </p>
              <p className={styles.small}>
                Which languages come first, and who reviews them, is still to be decided. There is
                no language switch until there is a real translation behind it.
              </p>
            </Stack>
          </Card>
        </Section>

        <Section
          title="Other ways to get help"
          id="help"
          intro="Digital is a choice, not a condition. Every step can also be done with a person."
        >
          <Rows label="Other ways to get help">
            <Row
              href="/help/"
              title="Get help"
              lead={<LifeBuoy />}
              text="Send a message or ask for a call-back."
            />
            <Row
              href="/service-points/"
              title="Assisted service at a service point"
              lead={<MapPinned />}
              text="An adviser can go through any step with you. Each service point lists its accessibility details."
            />
          </Rows>
        </Section>

        <Notice tone="neutral" title="How accessible is this prototype?">
          <p>
            The target is the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. It has
            not yet been independently tested, including with people who use assistive technology,
            so there may be barriers we have not found.
          </p>
        </Notice>
      </Stack>
    </Container>
  );
}
