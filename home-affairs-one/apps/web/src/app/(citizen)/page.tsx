import { DEMO } from '@hao/api-contracts';
import {
  AppLink,
  Cluster,
  Container,
  Eyebrow,
  Grid,
  LinkButton,
  Notice,
  SampleNotice,
} from '@hao/design-system';
import { CHANNEL_INFO } from '@hao/shared-types';
import {
  ArrowRight,
  Bell,
  Check,
  ClipboardList,
  Headset,
  Inbox,
  Mail,
  MapPinned,
  MessageCircle,
  MessageSquareText,
  PencilLine,
  Route,
} from 'lucide-react';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { PhotoCard } from '@/components/cards';
import { Photo } from '@/components/Photo';
import { serviceHref } from '@/lib/catalogue';
import styles from './welcome.module.css';

export const metadata: Metadata = {
  title: 'Home Affairs One — one trusted front door (concept prototype)',
};

const FEATURES = [
  {
    icon: <PencilLine aria-hidden="true" />,
    title: 'Apply in clear steps',
    text: 'Short forms that say why each detail is needed. Stop at any point and pick up where you left off.',
  },
  {
    icon: <Route aria-hidden="true" />,
    title: 'Track every application',
    text: 'One timeline shows what has happened, what is happening now and what you need to do next.',
  },
  {
    icon: <Bell aria-hidden="true" />,
    title: 'Choose how we contact you',
    text: 'A secure inbox for official notices, with optional reminders that never carry personal details.',
  },
  {
    icon: <Headset aria-hidden="true" />,
    title: 'Reach a person',
    text: 'Ask for a call-back or visit a service point. Your place in the journey comes with you.',
  },
];

const CHANNELS = [
  { key: 'SECURE_INBOX', icon: <Inbox aria-hidden="true" /> },
  { key: 'WHATSAPP', icon: <MessageCircle aria-hidden="true" /> },
  { key: 'EMAIL', icon: <Mail aria-hidden="true" /> },
  { key: 'SMS', icon: <MessageSquareText aria-hidden="true" /> },
] as const;

export default function WelcomePage() {
  return (
    <>
      <Container>
        <section className={styles.hero} aria-labelledby="hero-heading">
          <Photo
            asset="A12"
            className={styles.heroPhoto}
            sizes="(min-width: 72rem) 72rem, 100vw"
            shape="square"
            priority
          />
          <div className={`${styles.heroText} on-dark`}>
            <span className="rise">
              <Eyebrow inverse>A concept for South Africa</Eyebrow>
            </span>
            <h1 id="hero-heading" className="rise" style={{ '--rise-index': 1 } as CSSProperties}>
              One trusted front door to <em>Home Affairs</em> services.
            </h1>
            <p className={`${styles.heroLede} rise`} style={{ '--rise-index': 2 } as CSSProperties}>
              Apply, track and get help in one secure place — on your phone, on the web, or with a
              person beside you.
            </p>
            <Cluster gap={3} className="rise" style={{ '--rise-index': 3 } as CSSProperties}>
              <LinkButton href="/sign-in/" variant="inverse" size="lg">
                Sign in to the demo
              </LinkButton>
              <LinkButton href="/services/" variant="inverseOutline" size="lg">
                Explore services
              </LinkButton>
            </Cluster>
            <p className={`${styles.heroNote} rise`} style={{ '--rise-index': 4 } as CSSProperties}>
              The demo signs you in as a synthetic person. Nothing here is a real record.
            </p>
          </div>
        </section>
      </Container>

      <Container as="section" className={styles.section} aria-labelledby="what-heading">
        <div className={styles.sectionHead}>
          <Eyebrow>What it does</Eyebrow>
          <h2 id="what-heading">Simple to start. Clear all the way through.</h2>
        </div>
        <Grid gap={6} min="15rem">
          {FEATURES.map((feature) => (
            <div className={styles.feature} key={feature.title}>
              {feature.icon}
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </div>
          ))}
        </Grid>
      </Container>

      <Container as="section" className={styles.section} aria-labelledby="start-heading">
        <div className={styles.sectionHead}>
          <Eyebrow>Start with what you need</Eyebrow>
          <h2 id="start-heading">Organised around what you are trying to do</h2>
          <p>
            “Register a birth”, not a form number. Every service says what happens, step by step.
          </p>
        </div>
        <Grid gap={4} min="15.5rem">
          <PhotoCard
            asset="A16"
            href={serviceHref(DEMO.services.smartIdReplacement)}
            title="Replace a Smart ID"
            cta="See how it works"
          >
            Start online, then choose where to complete the in-person step.
          </PhotoCard>
          <PhotoCard
            asset="A19"
            href={serviceHref(DEMO.services.adultPassport)}
            title="Apply for an adult passport"
            cta="See how it works"
          >
            Apply, book a time and follow your application through to collection.
          </PhotoCard>
          <PhotoCard
            asset="A22"
            href={serviceHref(DEMO.services.birthRegistration)}
            title="Register a birth"
            cta="See how it works"
          >
            A guided start for parents and guardians, validated by a registrar.
          </PhotoCard>
          <PhotoCard
            asset="A31"
            href={serviceHref(DEMO.services.eta)}
            title="Travel to South Africa"
            cta="See how it works"
          >
            Guidance on electronic travel authorisation and where the application continues.
          </PhotoCard>
        </Grid>
        <Cluster gap={4} justify="space-between" style={{ marginTop: 'var(--space-5)' }}>
          <SampleNotice>
            Service steps are illustrative. Real requirements, fees and timeframes will come from
            Home Affairs service owners.
          </SampleNotice>
          <LinkButton
            href="/services/"
            variant="secondary"
            iconEnd={<ArrowRight aria-hidden="true" />}
          >
            See all services
          </LinkButton>
        </Cluster>
      </Container>

      <section className={`${styles.band} on-dark`} aria-labelledby="everyone-heading">
        <Container className={styles.bandGrid}>
          <div className={styles.bandText}>
            <Eyebrow inverse>Accessible by default</Eyebrow>
            <h2 id="everyone-heading">A service that includes everyone</h2>
            <p>
              Digital is a choice, not a condition. Every journey has an in-person route, and the
              app is built to work for the person in front of it.
            </p>
            <ul className={styles.checks}>
              <li>
                <Check aria-hidden="true" />
                <span>Works with screen readers, keyboards, larger text and higher contrast.</span>
              </li>
              <li>
                <Check aria-hidden="true" />
                <span>
                  A low-data mode for slow or costly connections, and clear offline states.
                </span>
              </li>
              <li>
                <Check aria-hidden="true" />
                <span>Help in person at service offices, partner banks and mobile units.</span>
              </li>
              <li>
                <Check aria-hidden="true" />
                <span>
                  Someone you trust can help you — and you stay in control of your account.
                </span>
              </li>
            </ul>
            <Cluster gap={3}>
              <LinkButton href="/profile/accessibility/" variant="inverse">
                Accessibility settings
              </LinkButton>
              <LinkButton
                href="/service-points/"
                variant="inverseOutline"
                iconStart={<MapPinned aria-hidden="true" />}
              >
                Find a service point
              </LinkButton>
            </Cluster>
          </div>
          <div className={styles.collage}>
            <Photo
              asset="A55"
              ratio="16 / 9"
              className={styles.collageWide}
              sizes="(min-width: 60rem) 36rem, 100vw"
            />
            <Photo
              asset="A04"
              ratio="4 / 5"
              className={styles.collageA}
              sizes="(min-width: 60rem) 18rem, 50vw"
            />
            <Photo
              asset="A08"
              ratio="4 / 5"
              className={styles.collageB}
              sizes="(min-width: 60rem) 18rem, 50vw"
            />
          </div>
        </Container>
      </section>

      <Container as="section" className={styles.section} aria-labelledby="channels-heading">
        <div className={styles.channels}>
          <div>
            <div className={styles.sectionHead}>
              <Eyebrow>One conversation, every channel</Eyebrow>
              <h2 id="channels-heading">Start anywhere. Carry on without starting again.</h2>
              <p>
                The secure inbox holds the detail. Other channels only nudge you back to it with a
                masked reference and a secure link.
              </p>
            </div>
            <ul className={styles.channelList}>
              {CHANNELS.map(({ key, icon }) => (
                <li key={key}>
                  {icon}
                  <strong>{CHANNEL_INFO[key].label}</strong>
                  <span>{CHANNEL_INFO[key].bestFor}.</span>
                </li>
              ))}
              <li>
                <ClipboardList aria-hidden="true" />
                <strong>In person</strong>
                <span>Identity capture, collection and help with any step.</span>
              </li>
            </ul>
            <Notice tone="attention" title="We will never ask for your password or one-time PIN">
              <p>
                Not by phone, WhatsApp, SMS or email. Documents are only ever uploaded inside the
                secure service.{' '}
                <AppLink href="/help/official-channels/">
                  How to recognise the official channels
                </AppLink>
                .
              </p>
            </Notice>
          </div>
          <Photo asset="A07" ratio="4 / 3" shape="soft" sizes="(min-width: 60rem) 34rem, 100vw" />
        </div>
      </Container>

      <Container as="section" className={styles.section} aria-labelledby="life-heading">
        <div className={styles.life}>
          <div className={styles.lifePhotos}>
            <Photo asset="A01" ratio="3 / 4" shape="arch" sizes="(min-width: 60rem) 15rem, 45vw" />
            <Photo asset="A10" ratio="3 / 4" shape="arch" sizes="(min-width: 60rem) 15rem, 45vw" />
          </div>
          <div className={styles.lifeText}>
            <Eyebrow>Built around life, not forms</Eyebrow>
            <h2 id="life-heading">Identity touches the moments that matter</h2>
            <p>
              A first ID. A new baby. A marriage. A journey. A loss. Home Affairs One organises
              services around those moments, explains each step in plain language, and tells you the
              truth about where your application stands.
            </p>
            <div>
              <LinkButton href="/services/" iconEnd={<ArrowRight aria-hidden="true" />}>
                Browse by life event
              </LinkButton>
            </div>
          </div>
        </div>
      </Container>

      <Container as="section" className={styles.section} aria-labelledby="install-heading">
        <div className={styles.install}>
          <Photo
            asset="A56"
            ratio="3 / 4"
            shape="arch"
            className={styles.installPhoto}
            sizes="13rem"
          />
          <div className={styles.installText}>
            <Eyebrow>Take it with you</Eyebrow>
            <h2 id="install-heading">Keep Home Affairs One on your home screen</h2>
            <p>
              Add it from your browser’s menu and it opens like an app. Drafts stay on your device,
              and it tells you clearly when you are offline.
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              On a slow or costly connection? Switch on “Use less data” in{' '}
              <AppLink href="/profile/accessibility/">Accessibility settings</AppLink>.
            </p>
          </div>
        </div>
      </Container>

      <Container as="section" className={styles.section} aria-labelledby="about-heading">
        <div className={styles.closing}>
          <Eyebrow>About this concept</Eyebrow>
          <h2 id="about-heading" style={{ fontSize: 'var(--text-2xl)' }}>
            A working idea, shown honestly
          </h2>
          <p>
            Home Affairs One is a design concept and a clickable prototype. It is not connected to
            any Home Affairs system. People, applications, offices and messages are invented, and
            service details are placeholders until the department supplies and approves them.
          </p>
          <div>
            <LinkButton href="/about/" variant="quiet" iconEnd={<ArrowRight aria-hidden="true" />}>
              Read more about the prototype
            </LinkButton>
          </div>
        </div>
      </Container>
    </>
  );
}
