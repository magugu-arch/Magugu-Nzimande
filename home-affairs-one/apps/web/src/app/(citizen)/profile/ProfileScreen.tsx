'use client';

import { announce } from '@hao/accessibility';
import {
  AppLink,
  Avatar,
  Button,
  Card,
  Cluster,
  Container,
  PageHeader,
  Section,
  Split,
  Stack,
  Tag,
} from '@hao/design-system';
import { ASSURANCE_TIER_INFO, meetsTier } from '@hao/shared-types';
import {
  Accessibility,
  Bell,
  FlaskConical,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Row, Rows } from '@/components/cards';
import { QueryBoundary } from '@/components/QueryBoundary';
import { formatRelative } from '@/lib/format';
import { useGatewayQuery } from '@/lib/queries';
import { useSession } from '@/lib/session';
import styles from './profile.module.css';
import { CONTACT_ICON, CONTACT_LABEL, VerifiedTag, currentTier } from './shared';

export function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const token = session?.subjectRef ?? '';
  const account = useGatewayQuery(['account', token], (g) => g.identity.getAccount(token), {
    enabled: Boolean(token),
  });

  if (!session) return null;
  const tier = currentTier(session);
  const tierInfo = ASSURANCE_TIER_INFO[tier];
  const verified = meetsTier(tier, 'A2');
  const needsVerified = verified ? undefined : <Tag>Needs a verified account</Tag>;

  const leave = () => {
    signOut();
    announce('Signed out.');
    router.push('/');
  };

  return (
    <Container>
      <div className={styles.head}>
        <Avatar initials={session.initials} size="lg" tone="gold" />
        <PageHeader title={session.displayName}>
          <Cluster gap={3}>
            <Tag tone={verified ? 'success' : 'neutral'} icon={<ShieldCheck aria-hidden="true" />}>
              {tierInfo.label}
            </Tag>
            <span className={styles.small}>Signed in {formatRelative(session.signedInAt)}</span>
          </Cluster>
        </PageHeader>
      </div>

      <Split gap={6}>
        <Stack gap={6}>
          <Section title="Contact details" id="contacts">
            <QueryBoundary
              query={account}
              loadingLabel="Loading your contact details"
              loadingRows={2}
            >
              {(person) => (
                <Card>
                  <Stack gap={3}>
                    {person.contacts.length > 0 ? (
                      <ul className={styles.contacts}>
                        {person.contacts.map((contact) => (
                          <li key={contact.channel} className={styles.contact}>
                            <span className={styles.contactIcon}>
                              {CONTACT_ICON[contact.channel]}
                            </span>
                            <span className={styles.contactText}>
                              <span className={styles.contactLabel}>
                                {CONTACT_LABEL[contact.channel]}
                              </span>
                              <span className={styles.contactValue}>{contact.maskedValue}</span>
                            </span>
                            <VerifiedTag verified={contact.verified} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No contact details are held for this account.</p>
                    )}
                    <p className={styles.small}>
                      Only part of each contact is shown, so it stays private on a shared screen.
                      Changing contact details is not part of this prototype.{' '}
                      <AppLink href="/profile/security/">Verify a contact</AppLink>.
                    </p>
                  </Stack>
                </Card>
              )}
            </QueryBoundary>
          </Section>

          <Section title="Settings" id="settings">
            <Rows label="Settings">
              <Row
                href="/profile/security/"
                title="Sign-in and security"
                lead={<ShieldCheck />}
                text="Your level, passkey, verified contacts and what to do if you lose your phone."
              />
              <Row
                href="/profile/family/"
                title="Family and delegates"
                lead={<Users />}
                meta={needsVerified}
                text="Children you are responsible for, and people you have asked to help you."
              />
              <Row
                href="/profile/privacy/"
                title="Privacy and consent"
                lead={<LockKeyhole />}
                meta={needsVerified}
                text="See what was shared, with whom and why — and withdraw consent."
              />
              <Row
                href="/messages/preferences/"
                title="Contact preferences"
                lead={<Bell />}
                meta={needsVerified}
                text="Choose which channels may send you reminders."
              />
              <Row
                href="/profile/accessibility/"
                title="Accessibility and data"
                lead={<Accessibility />}
                text="Text size, contrast, motion and using less data."
              />
              <Row
                href="/profile/prototype/"
                title="Prototype controls"
                lead={<FlaskConical />}
                text="For reviewers: feature flags, a simulated connection and resetting sample data."
              />
            </Rows>
          </Section>
        </Stack>

        <Stack gap={4}>
          <Card tone="brand" className={styles.level}>
            <p className={styles.levelLabel}>Your level</p>
            <h2>
              {tierInfo.label} ({tier})
            </h2>
            <p>{tierInfo.summary}</p>
            <p>
              Signing in shows you control this account. How much you can do depends on how strongly
              your identity has been checked.
            </p>
            <AppLink href="/profile/security/">
              <ShieldCheck aria-hidden="true" size={18} />
              See how levels work
            </AppLink>
          </Card>
          <div>
            <Button variant="secondary" onClick={leave} iconStart={<LogOut aria-hidden="true" />}>
              Sign out
            </Button>
          </div>
        </Stack>
      </Split>
    </Container>
  );
}
