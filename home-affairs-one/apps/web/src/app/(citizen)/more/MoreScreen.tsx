'use client';

import { announce } from '@hao/accessibility';
import {
  AppLink,
  Avatar,
  Button,
  Card,
  Container,
  LinkButton,
  PageHeader,
  Section,
  Stack,
  Tag,
} from '@hao/design-system';
import { ASSURANCE_TIER_INFO } from '@hao/shared-types';
import {
  Accessibility,
  Bell,
  BriefcaseBusiness,
  Compass,
  FlaskConical,
  Globe,
  Handshake,
  Info,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  MapPinned,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Row, Rows } from '@/components/cards';
import { useFlags } from '@/lib/prefs';
import { useSession } from '@/lib/session';
import styles from './more.module.css';

export function MoreScreen() {
  const router = useRouter();
  const { session, ready, signOut } = useSession();
  const { flags } = useFlags();
  const citizen = session?.role === 'citizen' ? session : null;

  const leave = () => {
    signOut();
    announce('Signed out.');
    router.push('/');
  };

  return (
    <Container width="narrow">
      <PageHeader title="More" lede="Your account, help, settings and the rest of the prototype." />

      <Stack gap={6}>
        {!ready ? (
          <div className={styles.placeholder} />
        ) : citizen ? (
          <Card>
            <div className={styles.identity}>
              <Avatar initials={citizen.initials} size="lg" tone="gold" />
              <div className={styles.identityText}>
                <p className={styles.identityName}>
                  <AppLink href="/profile/">{citizen.displayName}</AppLink>
                </p>
                <div>
                  <Tag icon={<ShieldCheck aria-hidden="true" />}>
                    {ASSURANCE_TIER_INFO[citizen.tier].label}
                  </Tag>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={leave}
                iconStart={<LogOut aria-hidden="true" />}
              >
                Sign out
              </Button>
            </div>
          </Card>
        ) : (
          <Card tone="sunken">
            <div className={styles.signedOut}>
              <p>Sign in to see your applications, messages and profile.</p>
              <LinkButton href="/sign-in/">Sign in</LinkButton>
            </div>
          </Card>
        )}

        <Section title="Your account" id="account">
          <Rows label="Your account">
            <Row
              href="/profile/"
              title="Profile"
              lead={<UserRound />}
              text="Your level, contact details and sign-in."
            />
            {flags.wallet ? (
              <Row
                href="/wallet/"
                title="Wallet"
                lead={<WalletCards />}
                meta={<Tag tone="info">Concept</Tag>}
                text="A future capability, shown as a design concept only."
              />
            ) : null}
            <Row
              href="/profile/family/"
              title="Family and delegates"
              lead={<Users />}
              text="Children you are responsible for, and people helping you."
            />
            <Row
              href="/profile/privacy/"
              title="Privacy and consent"
              lead={<LockKeyhole />}
              text="What was shared, with whom and why."
            />
          </Rows>
        </Section>

        <Section title="Find and get help" id="help">
          <Rows label="Find and get help">
            <Row
              href="/service-points/"
              title="Service points"
              lead={<MapPinned />}
              text="Offices, partner banks and mobile units."
            />
            <Row
              href="/abroad/"
              title="South Africans abroad"
              lead={<Globe />}
              text="Services through missions outside South Africa."
            />
            <Row
              href="/help/"
              title="Get help"
              lead={<LifeBuoy />}
              text="Send a message or ask for a call-back."
            />
            {flags.aiGuide ? (
              <Row
                href="/guide/"
                title="Service guide"
                lead={<Compass />}
                meta={<Tag tone="info">Future capability</Tag>}
                text="Finds and quotes guidance. It never makes decisions."
              />
            ) : null}
            <Row
              href="/search/"
              title="Search"
              lead={<Search />}
              text="Look for a service or a piece of guidance."
            />
          </Rows>
        </Section>

        <Section title="Settings" id="settings">
          <Rows label="Settings">
            <Row
              href="/profile/accessibility/"
              title="Accessibility and data"
              lead={<Accessibility />}
              text="Text size, contrast, motion and using less data."
            />
            <Row
              href="/messages/preferences/"
              title="Contact preferences"
              lead={<Bell />}
              text="Choose which channels may send you reminders."
            />
          </Rows>
        </Section>

        <Section title="This prototype" id="prototype">
          <Rows label="This prototype">
            <Row
              href="/about/"
              title="About"
              lead={<Info />}
              text="What this concept is, what it is not, and image credits."
            />
            <Row
              href="/profile/prototype/"
              title="Prototype controls"
              lead={<FlaskConical />}
              text="For reviewers: feature flags, a simulated connection and reset."
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
                text="How an accredited institution could ask a yes or no question."
              />
            ) : null}
          </Rows>
        </Section>
      </Stack>
    </Container>
  );
}
