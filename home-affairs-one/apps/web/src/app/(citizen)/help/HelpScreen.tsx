'use client';

import {
  AppLink,
  Card,
  Container,
  EmptyState,
  FutureNotice,
  Grid,
  LinkButton,
  Notice,
  PageHeader,
  SampleNotice,
  Section,
  Stack,
} from '@hao/design-system';
import {
  ArrowRight,
  BookOpenText,
  History,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { IconTile, PhotoCard, Row, Rows } from '@/components/cards';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { useFlags } from '@/lib/prefs';
import { useGatewayQuery } from '@/lib/queries';
import styles from './help.module.css';

const CONTACT_PLACEHOLDER = 'The department will publish the official contact details here.';

function guidanceHref(id: string): string {
  return `/help/guidance/?id=${encodeURIComponent(id)}`;
}

export function HelpScreen() {
  const { flags } = useFlags();
  const guidance = useGatewayQuery(['guidance'], (g) => g.catalogue.listGuidance());
  const alerts = useGatewayQuery(['alerts'], (g) => g.notifications.listAlerts());

  return (
    <Container>
      <PageHeader
        title="Get help"
        lede="Choose the way that suits you. Whichever you pick, you will not have to start again."
      />

      <Stack gap={8} className={styles.page}>
        <Section title="Reach a person" id="reach">
          <Grid gap={4} min="15.5rem">
            <PhotoCard
              asset="A25"
              href="/help/callback/"
              title="Request a call-back"
              cta="Ask for a call"
            >
              Say what you need and when suits you. An adviser picks it up from there.
            </PhotoCard>
            <PhotoCard
              asset="A05"
              href="/service-points/"
              title="Talk to someone in person"
              cta="Find a service point"
            >
              Service offices, partner bank points and mobile units, with their accessibility
              details.
            </PhotoCard>
            <PhotoCard
              asset="A34"
              href="#contact-centre"
              title="Contact centre"
              cta="How it works"
            >
              Speak to an adviser who can see the same timeline you do, after a security check.
            </PhotoCard>
          </Grid>
        </Section>

        {/* The anchor target for the "Contact centre" card above. */}
        <div id="contact-centre" className={styles.anchor} tabIndex={-1}>
          <Section title="Contact centre" id="contact-centre-section">
            <Card>
              <Stack gap={4}>
                <ul className={styles.points}>
                  <li>
                    <ShieldCheck aria-hidden="true" />
                    <span>
                      <strong>A step-up check comes first.</strong> An adviser can only look up an
                      application after you have confirmed who you are. Nothing personal is
                      discussed before that.
                    </span>
                  </li>
                  <li>
                    <History aria-hidden="true" />
                    <span>
                      <strong>They see the same timeline you do.</strong> The adviser works from
                      the status and history shown in your applications, so you do not have to
                      explain it from the beginning.
                    </span>
                  </li>
                  <li>
                    <ShieldAlert aria-hidden="true" />
                    <span>
                      <strong>They will never ask for your password or one-time PIN,</strong> or
                      for a payment to a personal account.{' '}
                      <AppLink href="/help/official-channels/">Know the official channels</AppLink>
                    </span>
                  </li>
                </ul>
                <Notice tone="neutral" title="Contact details">
                  <p>{CONTACT_PLACEHOLDER}</p>
                </Notice>
                <div>
                  <LinkButton
                    href="/help/callback/"
                    variant="secondary"
                    iconEnd={<ArrowRight aria-hidden="true" />}
                  >
                    Request a call-back instead
                  </LinkButton>
                </div>
              </Stack>
            </Card>
          </Section>
        </div>

        <Section title="Help that fits you" id="fits">
          <div className={styles.editorials}>
            <article className={styles.editorial}>
              <Photo asset="A40" ratio="4 / 3" shape="soft" sizes="(min-width: 60rem) 32rem, 100vw" />
              <div className={styles.editorialText}>
                <h3>Someone you trust can help you</h3>
                <p>
                  A family member or friend can sit beside you and help with any step. You keep
                  control of your own phone and your own account — they help, you decide.
                </p>
                <p>
                  Nobody should ask for your password or one-time PIN, not even someone who is
                  helping you.
                </p>
                <p className={styles.small}>
                  Formal delegate access, where someone acts for you with their own sign-in, is a
                  planned feature. <AppLink href="/profile/family/">Family and delegates</AppLink>
                </p>
              </div>
            </article>

            <article className={`${styles.editorial} ${styles.editorialFlip}`}>
              <Photo asset="A27" ratio="4 / 3" shape="soft" sizes="(min-width: 60rem) 32rem, 100vw" />
              <div className={styles.editorialText}>
                <h3>Help by voice, in your language</h3>
                <p>
                  Listening can be easier than reading. The aim is spoken guidance for each step,
                  in the language you choose.
                </p>
                <FutureNotice>
                  Multilingual voice guidance is a future capability. Critical legal translations
                  need human review before they are used.
                </FutureNotice>
              </div>
            </article>
          </div>
        </Section>

        <Section
          title="Answers to common questions"
          id="answers"
          action={{ href: '/help/guidance/', label: 'See all guidance' }}
        >
          <QueryBoundary
            query={guidance}
            loadingLabel="Loading guidance"
            headingLevel={3}
            isEmpty={(items) => items.length === 0}
            empty={
              <EmptyState
                title="No guidance to show yet"
                headingLevel={3}
                icon={<BookOpenText />}
                actions={<LinkButton href="/help/callback/">Request a call-back</LinkButton>}
              >
                <p>You can still reach a person using the options above.</p>
              </EmptyState>
            }
          >
            {(items) => (
              <Rows label="Common questions">
                {items.slice(0, 6).map((article) => (
                  <Row
                    key={article.id}
                    href={guidanceHref(article.id)}
                    title={article.title}
                    lead={<BookOpenText />}
                  />
                ))}
              </Rows>
            )}
          </QueryBoundary>
          <SampleNotice>
            Guidance in this prototype explains how the concept works. It is not official Home
            Affairs advice.
          </SampleNotice>
        </Section>

        <Section
          title="Service notices"
          id="notices"
          intro="These are sample notices, to show where real ones would appear."
        >
          <QueryBoundary
            query={alerts}
            loadingLabel="Loading service notices"
            loadingRows={2}
            headingLevel={3}
            isEmpty={(items) => items.length === 0}
            empty={<Notice tone="neutral">There are no service notices right now.</Notice>}
          >
            {(items) => (
              <Stack gap={3}>
                {items.map((alert) => (
                  <Notice
                    key={alert.alertId}
                    tone={alert.severity === 'attention' ? 'attention' : 'info'}
                    title={alert.title}
                  >
                    <p>{alert.body}</p>
                  </Notice>
                ))}
              </Stack>
            )}
          </QueryBoundary>
        </Section>

        <Section title="More ways to sort things out" id="more">
          <Grid gap={3} min="15rem">
            <IconTile
              href="/help/complaint/"
              icon={<MessageSquareWarning />}
              title="Make a complaint or give feedback"
              hint="A person reads every one."
            />
            <IconTile
              href="/help/official-channels/"
              icon={<ShieldAlert />}
              title="Know the official channels"
              hint="How to tell a real message from a fake one."
            />
            {flags.aiGuide ? (
              <IconTile
                href="/guide/"
                icon={<Sparkles />}
                title="Ask the service guide"
                hint="A preview. It finds and quotes sample guidance, and never decides anything."
              />
            ) : null}
          </Grid>
        </Section>
      </Stack>
    </Container>
  );
}
