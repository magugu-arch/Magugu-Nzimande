'use client';

import { announce } from '@hao/accessibility';
import type { ConceptCredential, Partner } from '@hao/api-contracts';
import {
  Button,
  Card,
  Container,
  DescriptionList,
  Dialog,
  EmptyState,
  FutureNotice,
  Grid,
  LinkButton,
  Notice,
  PageHeader,
  Section,
  Select,
  Stack,
  Tag,
  type CardProps,
} from '@hao/design-system';
import { CircleDashed, Eye, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { useGatewayQuery } from '@/lib/queries';
import { usePersonToken } from '@/lib/session';
import styles from './wallet.module.css';

/** Tiles are plain tinted panels with words. The tint only tells the kinds apart. */
const TILE_TONE: Record<ConceptCredential['type'], NonNullable<CardProps['tone']>> = {
  DIGITAL_ID: 'info',
  BIRTH_CERTIFICATE: 'success',
  MARRIAGE_CERTIFICATE: 'attention',
  TRAVEL_AUTHORISATION: 'sunken',
};

type Need = Partner['scopes'][number];

const NEEDS: Array<{ value: Need; label: string; purpose: string; question: string }> = [
  {
    value: 'OVER_18',
    label: 'That I am over 18',
    purpose: 'To confirm that you are an adult.',
    question: 'Is this person over 18?',
  },
  {
    value: 'IDENTITY_CONFIRMED',
    label: 'That my identity is confirmed',
    purpose: 'To confirm that you are who you say you are.',
    question: 'Has this person’s identity been confirmed?',
  },
  {
    value: 'DOCUMENT_STATUS',
    label: 'That a document is valid',
    purpose: 'To check that a document you showed them is still valid.',
    question: 'Is this document valid?',
  },
];

const LAUNCH_REQUIREMENTS = [
  {
    title: 'An authorised issuer signs every credential',
    text: 'Only an authorised Home Affairs issuer could issue one, signed so that anyone checking it can tell it is genuine and unchanged.',
  },
  {
    title: 'Storage protected by your device',
    text: 'Held using the phone’s secure hardware, and opened only by a method you control.',
  },
  {
    title: 'Sharing only what is needed',
    text: 'You share the one detail that was asked for — where the law accepts that — not the whole document.',
  },
  {
    title: 'You see who is asking, and why',
    text: 'The verifier’s identity, their purpose and how long the request lasts are shown before anything is shared.',
  },
  {
    title: 'Verifiers can check the issuer, status and revocation',
    text: 'An accredited verifier can confirm who issued a credential, that it is valid, and that it has not been cancelled.',
  },
  {
    title: 'Recovery and re-issue',
    text: 'A clear, safe way to get credentials back when a phone is lost, replaced or compromised.',
  },
  {
    title: 'Offline only where policy allows',
    text: 'Checking without a connection only where the trust rules, expiry and device security make it safe.',
  },
  {
    title: 'Always a physical alternative and a human route',
    text: 'A wallet stays a choice. Physical documents and help from a person remain available to everyone.',
  },
];

function ShareWalkthrough({ partners }: { partners: Partner[] }) {
  const [partnerRef, setPartnerRef] = useState(partners[0]?.partnerRef ?? '');
  const [needValue, setNeedValue] = useState<string>('OVER_18');
  const [open, setOpen] = useState(false);
  const [allowed, setAllowed] = useState(false);

  const partner = partners.find((candidate) => candidate.partnerRef === partnerRef) ?? partners[0];
  const need = NEEDS.find((candidate) => candidate.value === needValue) ?? NEEDS[0];
  if (!partner || !need) return null;
  const inScope = partner.scopes.includes(need.value);

  const show = () => {
    setAllowed(false);
    setOpen(true);
  };

  const allow = () => {
    setAllowed(true);
    announce('Concept only — nothing was shared.');
  };

  return (
    <>
      <div className={styles.share}>
        <div className={styles.shareFields}>
          <Select
            label="Who is asking?"
            hint="Invented organisations, for illustration."
            value={partner.partnerRef}
            onChange={(event) => setPartnerRef(event.target.value)}
            options={partners.map((item) => ({
              value: item.partnerRef,
              label: `${item.name} — ${item.sector}`,
            }))}
          />
          <Select
            label="What do they need to know?"
            hint="One question, not a whole document."
            value={need.value}
            onChange={(event) => setNeedValue(event.target.value)}
            options={NEEDS.map((item) => ({ value: item.value, label: item.label }))}
          />
        </div>
        <div>
          <Button onClick={show} iconStart={<Eye aria-hidden="true" />}>
            See what would be shared
          </Button>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Share with ${partner.name}?`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
            {inScope ? <Button onClick={allow}>Allow (concept)</Button> : null}
          </>
        }
      >
        <div className={styles.consent}>
          <Photo asset="A43" ratio="16 / 9" shape="soft" sizes="30rem" decorative />
          <div>
            <Tag icon={<CircleDashed aria-hidden="true" />}>Concept only</Tag>
          </div>
          <DescriptionList
            items={[
              { term: 'Who is asking', description: `${partner.name} (${partner.sector})` },
              { term: 'Why', description: need.purpose },
              {
                term: 'What they would receive',
                description: (
                  <>
                    A yes or no answer — not your date of birth or ID number.
                    <span className={styles.question}>The question: “{need.question}”</span>
                  </>
                ),
              },
              {
                term: 'How long it lasts',
                description: 'This one check only. It ends as soon as the answer is given.',
              },
              {
                term: 'Changing your mind',
                description:
                  'You could withdraw it at any time, and a receipt would be kept under Privacy and consent.',
              },
            ]}
          />
          {inScope ? null : (
            <Notice tone="attention" title="This request would be refused">
              <p>
                {partner.name} is not accredited to ask this question, so a real wallet would turn
                the request away before it reached you. There is nothing to allow.
              </p>
            </Notice>
          )}
          {allowed ? (
            <Notice tone="neutral" role="status" title="Concept only — nothing was shared.">
              <p>No answer was sent, no consent was recorded and no receipt was created.</p>
            </Notice>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

export function WalletScreen() {
  const token = usePersonToken() ?? '';
  const tiles = useGatewayQuery(
    ['concept-credentials', token],
    (g) => g.identity.listConceptCredentials(token),
    { enabled: Boolean(token) },
  );
  const partners = useGatewayQuery(['partners'], (g) => g.identity.listDemoPartners());

  return (
    <Container>
      <div className={styles.hero}>
        <div>
          <PageHeader
            eyebrow="Digital wallet"
            title="Your documents on your phone — one day"
            lede="A look at how official documents could be held safely on your own device, alongside the physical ones."
          />
          <div className={styles.concept}>
            <FutureNotice>
              A design concept. Nothing here is a valid credential, and nothing can be presented
              or verified. Physical documents remain valid.
            </FutureNotice>
          </div>
        </div>
        <Photo
          asset="A59"
          ratio="4 / 5"
          shape="arch"
          className={styles.heroPhoto}
          sizes="(min-width: 48rem) 19rem, 13rem"
          priority
        />
      </div>

      <Stack gap={7}>
        <Section
          title="What a wallet could hold"
          id="tiles"
          intro="These panels only describe an idea. They are not documents, and they hold none of your details."
        >
          <QueryBoundary
            query={tiles}
            loadingLabel="Loading the wallet concept"
            loadingRows={2}
            headingLevel={3}
            isEmpty={(items) => items.length === 0}
            empty={
              <EmptyState
                title="Nothing to show yet"
                headingLevel={3}
                icon={<WalletCards />}
                actions={
                  <LinkButton href="/services/" variant="secondary">
                    Browse services
                  </LinkButton>
                }
              >
                <p>There are no concept panels for this account. Your physical documents remain valid.</p>
              </EmptyState>
            }
          >
            {(items) => (
              <Grid gap={4} min="15rem">
                {items.map((tile) => (
                  <Card as="article" key={tile.credentialId} tone={TILE_TONE[tile.type]} className={styles.tile}>
                    <div>
                      <Tag icon={<CircleDashed aria-hidden="true" />}>Concept only</Tag>
                    </div>
                    <h3>{tile.title}</h3>
                    <p className={styles.tileText}>{tile.description}</p>
                    <p className={styles.tileProve}>
                      <strong>Would let you prove:</strong> {tile.claimNames.join(', ')}
                    </p>
                  </Card>
                ))}
              </Grid>
            )}
          </QueryBoundary>
        </Section>

        <Section
          title="Share only what is needed"
          id="share"
          intro="Today, proving one thing often means handing over a whole document. A wallet could answer just the question that was asked. Try it — this walk-through is illustrative and shares nothing."
        >
          <Card>
            <QueryBoundary
              query={partners}
              loadingLabel="Loading the example organisations"
              loadingRows={1}
              headingLevel={3}
              isEmpty={(items) => items.length === 0}
              empty={
                <Notice tone="neutral">
                  <p>There are no example organisations to try this with right now.</p>
                </Notice>
              }
            >
              {(items) => <ShareWalkthrough partners={items} />}
            </QueryBoundary>
          </Card>
        </Section>

        <section className={styles.verify} aria-labelledby="verify-heading">
          <div className={styles.verifyText}>
            <h2 id="verify-heading">Check a document without sending a scan</h2>
            <p>
              Organisations often ask for a scan or a copy of a document, and then keep it. With a
              wallet, a verifier could check the facts directly instead of receiving a copy.
            </p>
            <ul className={styles.points}>
              <li>
                <strong>The issuer</strong> — that it really was issued by the authority it names.
              </li>
              <li>
                <strong>Validity</strong> — that it has not expired.
              </li>
              <li>
                <strong>Status</strong> — that it has not been cancelled or replaced.
              </li>
            </ul>
            <p className={styles.muted}>
              Nothing is left behind in someone else’s filing cabinet or inbox.
            </p>
          </div>
          <Photo
            asset="A54"
            ratio="1 / 1"
            shape="soft"
            className={styles.verifyPhoto}
            sizes="(min-width: 48rem) 20rem, 100vw"
          />
        </section>

        <Section
          title="What must be true before this can launch"
          id="requirements"
          intro="A wallet is only worth having if it can be trusted. None of these has been decided, so none of it is live."
        >
          <ul className={styles.checklist}>
            {LAUNCH_REQUIREMENTS.map((requirement) => (
              <li key={requirement.title} className={styles.check}>
                <div>
                  <h3>{requirement.title}</h3>
                  <p className={styles.muted}>{requirement.text}</p>
                </div>
                <Tag tone="attention" icon={<CircleDashed aria-hidden="true" />}>
                  Not yet decided
                </Tag>
              </li>
            ))}
          </ul>
          <div className={styles.links}>
            <LinkButton href="/profile/privacy/" variant="secondary">
              See your consent receipts
            </LinkButton>
            <LinkButton href="/services/" variant="quiet">
              Browse services
            </LinkButton>
          </div>
        </Section>
      </Stack>
    </Container>
  );
}
