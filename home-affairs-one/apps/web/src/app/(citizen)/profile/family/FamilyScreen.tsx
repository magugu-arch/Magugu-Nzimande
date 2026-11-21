'use client';

import type { FamilyLink } from '@hao/api-contracts';
import {
  Avatar,
  Card,
  Container,
  DescriptionList,
  EmptyState,
  FutureNotice,
  Grid,
  LinkButton,
  Notice,
  PageHeader,
  Section,
  Stack,
  Tag,
  UnavailableState,
  cx,
} from '@hao/design-system';
import { CircleCheck, CircleDashed, Hourglass, MapPinned, PhoneCall, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { formatDate } from '@/lib/format';
import { useGatewayQuery } from '@/lib/queries';
import { usePersonToken } from '@/lib/session';
import styles from '../profile.module.css';

const RELATIONSHIP: Record<FamilyLink['relationship'], string> = {
  CHILD: 'Child',
  DEPENDANT: 'Dependant',
  DELEGATE: 'Person helping you',
};

const AUTHORITY: Record<FamilyLink['authority'], string> = {
  GUARDIAN: 'Guardian',
  DELEGATED: 'Delegated by you',
};

const VERIFICATION: Record<
  FamilyLink['verification'],
  { label: string; tone: 'success' | 'attention' | 'neutral'; icon: ReactNode }
> = {
  VERIFIED: { label: 'Verified', tone: 'success', icon: <CircleCheck aria-hidden="true" /> },
  PENDING: {
    label: 'Waiting for verification',
    tone: 'attention',
    icon: <Hourglass aria-hidden="true" />,
  },
  NOT_VERIFIED: { label: 'Not verified', tone: 'neutral', icon: <CircleDashed aria-hidden="true" /> },
};

function LinkCard({ link }: { link: FamilyLink }) {
  const verification = VERIFICATION[link.verification];
  return (
    <Card as="article" className={styles.linkCard}>
      <div className={styles.person}>
        <Avatar initials={link.relatedInitials} size="lg" tone="gold" />
        <div>
          <h3>{link.relatedDisplayName}</h3>
          <p className={styles.small}>{RELATIONSHIP[link.relationship]}</p>
        </div>
      </div>
      <div>
        <Tag tone={verification.tone} icon={verification.icon}>
          {verification.label}
        </Tag>
      </div>
      <DescriptionList
        items={[
          { term: 'Authority', description: AUTHORITY[link.authority] },
          ...(link.expiresAt ? [{ term: 'Ends', description: formatDate(link.expiresAt) }] : []),
        ]}
      />
      <div>
        <h4>What this allows</h4>
        {link.scope.length > 0 ? (
          <ul className={styles.plainList}>
            {link.scope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.small}>Nothing yet.</p>
        )}
      </div>
      {link.verification === 'VERIFIED' ? null : (
        <p className={styles.small}>
          Nothing above is allowed until the authority behind this link has been verified.
        </p>
      )}
    </Card>
  );
}

export function FamilyScreen() {
  const token = usePersonToken() ?? '';
  const links = useGatewayQuery(['family-links', token], (g) => g.identity.listFamilyLinks(token), {
    enabled: Boolean(token),
  });

  return (
    <Container>
      <PageHeader
        eyebrow="Profile"
        title="Family and delegates"
        lede="Children you are responsible for, and people you have asked to help you."
        back={{ href: '/profile/', label: 'Profile' }}
      >
        <FutureNotice>
          Acting for someone else is a later phase. It needs verified legal authority and clear
          consent rules.
        </FutureNotice>
      </PageHeader>

      <Stack gap={7}>
        <section className={styles.feature} aria-labelledby="guardians-heading">
          <div className={styles.featureText}>
            <h2 id="guardians-heading">Guardians and children</h2>
            <p>
              A parent or guardian often needs to apply, book or collect for a child. That has to
              be possible without treating a child’s identity as something the whole family can
              open.
            </p>
            <Notice tone="info" title="How children’s records are protected">
              <p>
                There is no casual family-account access to a child’s identity record. A link
                between you and a child exists only when legal authority has been verified — never
                because you share a surname, an address or a phone.
              </p>
            </Notice>
            <p className={styles.small}>
              The rules for age, guardian authority and safeguarding still have to be set with
              Home Affairs. Nothing on this page is a legal rule.
            </p>
          </div>
          <Photo
            asset="A21"
            ratio="4 / 5"
            shape="arch"
            className={styles.featurePhoto}
            sizes="(min-width: 48rem) 18rem, 14rem"
          />
        </section>

        <Section title="People linked to your account" id="links">
          <QueryBoundary
            query={links}
            loadingLabel="Loading the people linked to your account"
            loadingRows={2}
            headingLevel={3}
            isEmpty={(items) => items.length === 0}
            empty={
              <EmptyState
                title="Nobody is linked to your account"
                headingLevel={3}
                icon={<Users />}
                actions={
                  <LinkButton href="/service-points/" variant="secondary">
                    Find a service point
                  </LinkButton>
                }
              >
                <p>
                  You are not recorded as a guardian for anyone, and you have not asked anyone to
                  help you. Linking a person is not available online yet — see “Link a person”
                  below for what you can do today.
                </p>
              </EmptyState>
            }
          >
            {(items) => (
              <Grid gap={4} min="18rem">
                {items.map((link) => (
                  <LinkCard key={link.linkId} link={link} />
                ))}
              </Grid>
            )}
          </QueryBoundary>
        </Section>

        <section className={cx(styles.feature, styles.featureReverse)} aria-labelledby="helper-heading">
          <div className={styles.featureText}>
            <h2 id="helper-heading">Someone helping you</h2>
            <p>
              You may want a relative or someone you trust to help with your applications. They
              help; you stay in control of your account.
            </p>
            <ul className={styles.plainList}>
              <li>You choose exactly what they may do — nothing more.</li>
              <li>It has an end date, so help does not quietly become permanent.</li>
              <li>You can end it at any time, and you can see what was done in your name.</li>
              <li>They sign in as themselves. Nobody needs your passkey, password or codes.</li>
            </ul>
          </div>
          <Photo
            asset="A40"
            ratio="4 / 5"
            shape="arch"
            className={styles.featurePhoto}
            sizes="(min-width: 48rem) 18rem, 14rem"
          />
        </section>

        <Section title="Link a person" id="link">
          <UnavailableState
            headingLevel={3}
            title="Linking a person is not available online yet"
            reason="This is planned for a later phase. Linking someone to your account needs their legal authority, or your delegation, to be checked properly first — and those rules are not final."
            whatNext="Visit a service point with proof of your authority, or ask for a call-back and an adviser will explain what is needed."
            alternatives={[
              'You can still apply, book and track for yourself here.',
              'An adviser at a service point can help you and the person you care for together.',
            ]}
            actions={
              <>
                <LinkButton href="/service-points/" iconStart={<MapPinned aria-hidden="true" />}>
                  Find a service point
                </LinkButton>
                <LinkButton
                  href="/help/callback/"
                  variant="secondary"
                  iconStart={<PhoneCall aria-hidden="true" />}
                >
                  Request a call-back
                </LinkButton>
              </>
            }
          />
        </Section>
      </Stack>
    </Container>
  );
}
