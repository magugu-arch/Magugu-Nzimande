'use client';

import { announce } from '@hao/accessibility';
import type { ConsentRecord } from '@hao/api-contracts';
import {
  AppLink,
  Button,
  Card,
  Container,
  DescriptionList,
  Dialog,
  EmptyState,
  Grid,
  LinkButton,
  Notice,
  PageHeader,
  Section,
  Stack,
  Tag,
} from '@hao/design-system';
import {
  Ban,
  CircleCheck,
  Clock3,
  Eye,
  FileCheck,
  PencilLine,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { formatDate, formatDateTime } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useGatewayMutation, useGatewayQuery } from '@/lib/queries';
import { usePersonToken } from '@/lib/session';
import styles from '../profile.module.css';
import { isPast } from '../shared';

type ConsentStatus = 'active' | 'expired' | 'withdrawn';

/** Expiry is worked out on this device, so a receipt never claims to be live after its end date. */
function statusOf(consent: ConsentRecord): ConsentStatus {
  if (consent.revokedAt !== null) return 'withdrawn';
  if (consent.expiresAt !== null && isPast(consent.expiresAt)) return 'expired';
  return 'active';
}

const STATUS: Record<
  ConsentStatus,
  { label: string; tone: 'success' | 'attention' | 'neutral'; icon: ReactNode }
> = {
  active: { label: 'Active', tone: 'success', icon: <CircleCheck aria-hidden="true" /> },
  expired: { label: 'Expired', tone: 'attention', icon: <Clock3 aria-hidden="true" /> },
  withdrawn: { label: 'Withdrawn', tone: 'neutral', icon: <Ban aria-hidden="true" /> },
};

const PRINCIPLES = [
  {
    icon: <Eye aria-hidden="true" />,
    title: 'The purpose is shown first',
    text: 'Before a detail is collected or shared, you are told what it is for and who will see it.',
  },
  {
    icon: <ShieldCheck aria-hidden="true" />,
    title: 'Only what the service needs',
    text: 'Each service asks for the details it requires and nothing extra. A yes or no answer is shared instead of the detail behind it wherever that is enough.',
  },
  {
    icon: <PencilLine aria-hidden="true" />,
    title: 'You can see it and correct it',
    text: 'You can see what is held about you, where it came from, and ask for it to be put right.',
  },
  {
    icon: <Timer aria-hidden="true" />,
    title: 'Kept only as long as the law requires',
    text: 'Records are removed when there is no longer a lawful reason to keep them. The retention periods for each kind of record are still to be set.',
  },
];

interface Withdrawal {
  consent: ConsentRecord;
  /** Made when the dialog opens: one key for this intent, reused if the person tries again. */
  idempotencyKey: string;
}

function Receipt({ consent, onWithdraw }: { consent: ConsentRecord; onWithdraw: () => void }) {
  const status = statusOf(consent);
  const info = STATUS[status];
  return (
    <Card as="article" className={styles.receipt}>
      <div className={styles.cardHead}>
        <h3>{consent.purpose}</h3>
        <Tag tone={info.tone} icon={info.icon}>
          {info.label}
        </Tag>
      </div>
      <DescriptionList
        items={[
          { term: 'Shared with', description: consent.recipient },
          {
            term: 'What is shared',
            description: (
              <ul className={styles.plainList}>
                {consent.attributes.map((attribute) => (
                  <li key={attribute}>{attribute}</li>
                ))}
              </ul>
            ),
          },
          { term: 'Legal basis', description: consent.legalBasis },
          { term: 'Granted', description: formatDate(consent.grantedAt) },
          {
            term: status === 'expired' ? 'Expired' : 'Expires',
            description: consent.expiresAt
              ? formatDate(consent.expiresAt)
              : 'No end date. It lasts until you withdraw it.',
          },
          ...(consent.revokedAt
            ? [{ term: 'Withdrawn', description: formatDateTime(consent.revokedAt) }]
            : []),
          { term: 'Receipt reference', description: consent.consentRef },
        ]}
      />
      <div className={styles.receiptFoot}>
        {status === 'active' ? (
          <Button variant="secondary" onClick={onWithdraw}>
            Withdraw consent
            <span className="visually-hidden">: {consent.purpose}</span>
          </Button>
        ) : (
          <p className={styles.small}>
            {status === 'withdrawn'
              ? 'You withdrew this consent. Nothing more is shared under it.'
              : 'This consent has ended. Nothing more is shared under it.'}
          </p>
        )}
      </div>
    </Card>
  );
}

export function PrivacyScreen() {
  const token = usePersonToken() ?? '';
  const consents = useGatewayQuery(['consents', token], (g) => g.identity.listConsents(token), {
    enabled: Boolean(token),
  });
  const revoke = useGatewayMutation((g, input: Withdrawal) =>
    g.identity.revokeConsent(input.consent.consentRef, { idempotencyKey: input.idempotencyKey }),
  );

  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(null);
  const [withdrawn, setWithdrawn] = useState<{ purpose: string; recipient: string } | null>(null);

  // The button that opened the dialog disappears once the consent is withdrawn,
  // so focus moves to the confirmation instead of being lost.
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (withdrawn) resultRef.current?.focus();
  }, [withdrawn]);

  const open = (consent: ConsentRecord) => {
    revoke.reset();
    setWithdrawn(null);
    setWithdrawal({ consent, idempotencyKey: newIdempotencyKey('revoke-consent') });
  };

  const confirm = () => {
    if (!withdrawal) return;
    revoke.mutate(withdrawal, {
      onSuccess: (record) => {
        setWithdrawal(null);
        setWithdrawn({ purpose: record.purpose, recipient: record.recipient });
        announce('Consent withdrawn.');
      },
    });
  };

  return (
    <Container>
      <div className={styles.headSplit}>
        <PageHeader
          eyebrow="Profile"
          title="Privacy and consent"
          lede="You can always see what was shared, with whom and why — and change your mind."
          back={{ href: '/profile/', label: 'Profile' }}
        />
        <Photo
          asset="A43"
          ratio="4 / 5"
          className={styles.headPhoto}
          sizes="(min-width: 48rem) 17rem, 12rem"
        />
      </div>

      <Stack gap={7}>
        <Section
          title="Consent receipts"
          id="receipts"
          intro="Each time you agree to share something, a receipt is kept here. It says what, who and why in plain words."
        >
          <div ref={resultRef} tabIndex={-1} className={styles.result}>
            {withdrawn ? (
              <Notice tone="success" role="status" title="Consent withdrawn">
                <p>
                  {withdrawn.recipient} can no longer use your consent for: {withdrawn.purpose}. The
                  receipt stays here as a record.
                </p>
              </Notice>
            ) : null}
          </div>

          <QueryBoundary
            query={consents}
            loadingLabel="Loading your consent receipts"
            loadingRows={2}
            headingLevel={3}
            isEmpty={(items) => items.length === 0}
            empty={
              <EmptyState
                title="No consent receipts yet"
                headingLevel={3}
                icon={<FileCheck />}
                actions={
                  <LinkButton href="/messages/preferences/" variant="secondary">
                    Choose how we contact you
                  </LinkButton>
                }
              >
                <p>
                  You have not agreed to share anything. When you do — for example by switching on
                  reminders on another channel — the receipt appears here.
                </p>
              </EmptyState>
            }
          >
            {(items) => (
              <Grid gap={4} min="20rem">
                {items.map((consent) => (
                  <Receipt
                    key={consent.consentRef}
                    consent={consent}
                    onWithdraw={() => open(consent)}
                  />
                ))}
              </Grid>
            )}
          </QueryBoundary>
        </Section>

        <Section title="What we collect and why" id="principles">
          <ul className={styles.principles}>
            {PRINCIPLES.map((principle) => (
              <li key={principle.title} className={styles.principle}>
                {principle.icon}
                <h3>{principle.title}</h3>
                <p>{principle.text}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="On this device" id="device">
          <Card tone="sunken">
            <div className={styles.device}>
              <Photo asset="A51" ratio="1 / 1" parallax={false} sizes="6rem" decorative />
              <Stack gap={2}>
                <p>
                  This prototype keeps its sample data in your browser only. Nothing is sent
                  anywhere, and none of it is a real record.
                </p>
                <p>
                  You can clear it at any time in{' '}
                  <AppLink href="/profile/prototype/">Prototype controls</AppLink>.
                </p>
              </Stack>
            </div>
          </Card>
        </Section>
      </Stack>

      <Dialog
        open={withdrawal !== null}
        onClose={() => setWithdrawal(null)}
        title="Withdraw this consent?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setWithdrawal(null)}>
              Keep consent
            </Button>
            <Button variant="danger" onClick={confirm} loading={revoke.isPending}>
              Withdraw consent
            </Button>
          </>
        }
      >
        {withdrawal ? (
          <>
            <p>
              <strong>{withdrawal.consent.recipient}</strong> will no longer be able to use your
              consent for: {withdrawal.consent.purpose}.
            </p>
            <p>
              <strong>What stops working:</strong> anything that relies on this consent. New
              requests under it are refused from now on.
            </p>
            <p>
              Withdrawing does not undo what was already shared, and the receipt stays here as a
              record. You can give consent again later.
            </p>
            <p className={styles.small}>
              In this prototype, withdrawing updates the receipt only. If it covers reminders on
              another channel, switch that channel off in Contact preferences as well.
            </p>
            {revoke.isError ? (
              <Notice tone="danger" role="alert" title="The consent was not withdrawn">
                <p>{revoke.error.safeMessage}</p>
                <p>Reference for support: {revoke.error.traceRef}</p>
              </Notice>
            ) : null}
          </>
        ) : null}
      </Dialog>
    </Container>
  );
}
