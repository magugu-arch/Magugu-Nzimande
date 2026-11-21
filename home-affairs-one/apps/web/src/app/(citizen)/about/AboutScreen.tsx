'use client';

import { announce } from '@hao/accessibility';
import {
  Button,
  Card,
  Container,
  Eyebrow,
  Grid,
  PageHeader,
  Section,
  Stack,
  Tag,
  cx,
} from '@hao/design-system';
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Handshake,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Row, Rows } from '@/components/cards';
import { Photo } from '@/components/Photo';
import { ALL_ASSETS } from '@/lib/assets';
import { useFlags } from '@/lib/prefs';
import styles from './about.module.css';

const WHAT_IT_IS = [
  'A clickable design concept for one trusted front door to Home Affairs services.',
  'Filled with synthetic people, cases and places. Every one of them is invented.',
  'A way to try ideas with the public, officials and partners before anything real is built.',
  'Running entirely in your browser. Nothing you do here leaves this device.',
];

const WHAT_IT_IS_NOT = [
  'Not connected to any Home Affairs system. No real record can be seen or changed here.',
  'Not an official service, policy or decision of the Department of Home Affairs.',
  'Not a source of real requirements. Service details — steps, amounts and timeframes — are placeholders.',
  'Not a place for real personal details. Please do not enter any.',
];

const RULES = [
  {
    title: 'No invented fees, requirements or timeframes',
    text: 'Service content is sample content and is labelled as such until service owners supply the real thing.',
  },
  {
    title: 'Synthetic data only',
    text: 'No real people, documents, identity numbers or biometrics — anywhere.',
  },
  {
    title: 'No official marks',
    text: 'No coat of arms, seals, logos, identity cards or scannable codes are drawn or imitated.',
  },
  {
    title: 'AI assists and never decides',
    text: 'The service guide only finds and quotes guidance. It makes no decisions and submits nothing.',
  },
  {
    title: 'Outside channels carry very little',
    text: 'WhatsApp, SMS and email carry only a masked reference and a secure link — never case details.',
  },
  {
    title: 'Future capabilities stay behind flags',
    text: 'The wallet, biometric checks, the service guide and partner checks are labelled as future and can be switched off.',
  },
];

const FLAGGED = ALL_ASSETS.filter((asset) => asset.review === 'check');

function Gallery() {
  return (
    <ul className={styles.gallery}>
      {ALL_ASSETS.map((asset) => (
        <li key={asset.id}>
          <Card padding="flush" className={styles.shot}>
            <Photo asset={asset.id} ratio="4 / 3" sizes="12rem" shape="square" decorative />
            <div className={styles.shotBody}>
              <p className={styles.shotId}>{asset.id}</p>
              <p>{asset.subject}</p>
              <div>
                {asset.review === 'check' ? (
                  <Tag tone="attention" icon={<TriangleAlert aria-hidden="true" />}>
                    Needs review
                  </Tag>
                ) : (
                  <Tag>Concept use</Tag>
                )}
              </div>
              {asset.review === 'check' && asset.reviewNote ? (
                <p className={styles.shotNote}>{asset.reviewNote}</p>
              ) : null}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function AboutScreen() {
  const { flags } = useFlags();
  const [showGallery, setShowGallery] = useState(false);
  const total = ALL_ASSETS.length;

  const toggleGallery = () => {
    const next = !showGallery;
    setShowGallery(next);
    announce(next ? `Showing all ${total} photographs.` : 'Photographs hidden.');
  };

  return (
    <Container>
      <div className={styles.hero}>
        <PageHeader
          eyebrow="About"
          title="A working concept, shown honestly"
          lede="Home Affairs One is an idea you can click through. It shows how one front door to identity and civic services could feel — and it is careful not to pretend to be more than that."
        />
        <Photo
          asset="A55"
          ratio="16 / 10"
          shape="soft"
          sizes="(min-width: 60rem) 36rem, 100vw"
          priority
        />
      </div>

      <Stack gap={8}>
        <Grid gap={4} min="18rem">
          <Card as="section" aria-labelledby="is-heading">
            <Stack gap={4}>
              <h2 id="is-heading" className={styles.columnTitle}>
                What this is
              </h2>
              <ul className={cx(styles.list, styles.yes)}>
                {WHAT_IT_IS.map((item) => (
                  <li key={item}>
                    <Check aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Stack>
          </Card>
          <Card as="section" tone="sunken" aria-labelledby="is-not-heading">
            <Stack gap={4}>
              <h2 id="is-not-heading" className={styles.columnTitle}>
                What this is not
              </h2>
              <ul className={cx(styles.list, styles.no)}>
                {WHAT_IT_IS_NOT.map((item) => (
                  <li key={item}>
                    <X aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Stack>
          </Card>
        </Grid>

        <section className={styles.rules} aria-labelledby="rules-heading">
          <div className={styles.rulesText}>
            <Eyebrow>Guardrails</Eyebrow>
            <h2 id="rules-heading">The rules it follows</h2>
            <ol className={styles.ruleList}>
              {RULES.map((rule) => (
                <li key={rule.title}>
                  <h3>{rule.title}</h3>
                  <p>{rule.text}</p>
                </li>
              ))}
            </ol>
          </div>
          <Photo
            asset="A51"
            ratio="1 / 1"
            shape="soft"
            className={styles.rulesPhoto}
            sizes="(min-width: 60rem) 24rem, 100vw"
          />
        </section>

        <section className={styles.story} aria-labelledby="why-heading">
          <Photo
            asset="A10"
            ratio="3 / 4"
            shape="arch"
            className={styles.storyPhoto}
            sizes="(min-width: 48rem) 18rem, 14rem"
          />
          <div className={styles.storyText}>
            <Eyebrow>Why it exists</Eyebrow>
            <h2 id="why-heading">People first, cases second</h2>
            <p>
              A first ID. A new baby. A marriage. A journey. A loss. Identity touches the moments
              that matter most, and at those moments nobody should have to work out which office,
              which form or which queue is theirs. This concept starts from the person and what they
              are trying to do: one front door, whichever channel they come through, with plain
              words about what happens next.
            </p>
            <p>
              And no dead ends. When something cannot be done here, the service says why, what to do
              instead, and how to reach a person.
            </p>
          </div>
        </section>

        <Section title="Photographs" id="photographs">
          <div className={styles.credits}>
            <p>
              All {total} photographs in this prototype are illustrative, AI-generated concept
              images. They do not show real offices, staff, citizens or documents, and no person in
              them is a real individual. Photographs set a mood; every label, status and instruction
              is written by the app.
            </p>
            <p className={styles.count}>
              <strong>
                {total} photographs, {FLAGGED.length} flagged for review.
              </strong>{' '}
              Flagged images need a decision before any public use, and their review notes are shown
              with them.
            </p>
            <div>
              <Button
                variant="secondary"
                aria-expanded={showGallery}
                aria-controls="photo-gallery"
                onClick={toggleGallery}
                iconEnd={
                  showGallery ? (
                    <ChevronUp aria-hidden="true" />
                  ) : (
                    <ChevronDown aria-hidden="true" />
                  )
                }
              >
                {showGallery ? 'Hide all photographs' : 'Show all photographs'}
              </Button>
            </div>
          </div>
          <div id="photo-gallery" hidden={!showGallery}>
            {showGallery ? <Gallery /> : null}
          </div>
        </Section>

        <Section
          title="For reviewers"
          id="reviewers"
          intro="See the other sides of the concept, and the states that are hard to reach by hand."
        >
          <Rows label="For reviewers">
            <Row
              href="/profile/prototype/"
              title="Prototype controls"
              lead={<FlaskConical />}
              text="Feature flags, a simulated slow or failing connection, and resetting sample data."
            />
            <Row
              href="/staff/"
              title="Staff console"
              lead={<BriefcaseBusiness />}
              text="The case queue as an official would see it. Separate sign-in."
            />
            {flags.partnerIntegrations ? (
              <Row
                href="/partner/"
                title="Partner sandbox"
                lead={<Handshake />}
                meta={<Tag tone="info">Future capability</Tag>}
                text="How an accredited institution could ask a yes or no question, with consent."
              />
            ) : null}
          </Rows>
          {flags.partnerIntegrations ? null : (
            <p className={styles.note}>
              The partner sandbox is behind a feature flag that is switched off. Reviewers can
              switch it on in Prototype controls.
            </p>
          )}
        </Section>
      </Stack>
    </Container>
  );
}
