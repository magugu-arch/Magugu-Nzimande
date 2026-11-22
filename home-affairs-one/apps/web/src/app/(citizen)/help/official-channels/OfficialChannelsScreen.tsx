import { DEMO } from '@hao/api-contracts';
import {
  AppLink,
  Card,
  Container,
  Eyebrow,
  Grid,
  LinkButton,
  Notice,
  PageHeader,
  Section,
  Stack,
  UnavailableState,
} from '@hao/design-system';
import { CHANNELS, CHANNEL_INFO, maskReference, type Channel } from '@hao/shared-types';
import { Bell, Check, Inbox, Mail, MessageCircle, MessageSquareText, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Photo } from '@/components/Photo';
import styles from '../help.module.css';

const CHANNEL_ICON: Record<Channel, ReactNode> = {
  SECURE_INBOX: <Inbox aria-hidden="true" />,
  PUSH: <Bell aria-hidden="true" />,
  WHATSAPP: <MessageCircle aria-hidden="true" />,
  EMAIL: <Mail aria-hidden="true" />,
  SMS: <MessageSquareText aria-hidden="true" />,
};

/** What a masked reference looks like, made from a demo case token: `••••2481`. */
const MASK_EXAMPLE = maskReference(DEMO.cases.passportInProduction);

export function OfficialChannelsScreen() {
  return (
    <Container>
      <div className={styles.layout}>
        <div>
          <PageHeader
            back={{ href: '/help/', label: 'Get help' }}
            title="Know the official channels"
            lede="How to tell a real message from a fake one."
          />

          <Stack gap={7}>
            <Notice
              tone="attention"
              className={styles.never}
              title="We will never ask for your password or one-time PIN — not by phone, WhatsApp, SMS or email."
            >
              <p>
                <strong>We will never ask you to pay into a personal account.</strong> Anyone who
                asks for either of these is not us, whatever name or picture they use.
              </p>
            </Notice>

            <Section
              title="What each channel carries"
              id="channels"
              intro="The secure inbox holds the detail. Every other channel only points you back to it."
            >
              <Grid gap={4} min="17rem">
                {CHANNELS.map((channel) => {
                  const info = CHANNEL_INFO[channel];
                  return (
                    <Card key={channel} className={styles.channel}>
                      <div className={styles.channelHead}>
                        <h3>
                          {CHANNEL_ICON[channel]}
                          {info.label}
                        </h3>
                        <p>{info.bestFor}.</p>
                      </div>
                      <dl className={styles.channelFacts}>
                        <div>
                          <dt className={styles.carries}>
                            <Check aria-hidden="true" />
                            Carries
                          </dt>
                          <dd>{info.carries}</dd>
                        </div>
                        <div>
                          <dt className={styles.neverCarries}>
                            <X aria-hidden="true" />
                            Never carries
                          </dt>
                          <dd>{info.neverCarries}</dd>
                        </div>
                      </dl>
                    </Card>
                  );
                })}
              </Grid>
            </Section>

            <Section title="How to check a message" id="check">
              <ol className={styles.steps}>
                <li>
                  <span>
                    <strong>Look at the reference.</strong> A real message shows only a masked
                    reference, like <span className={styles.mask}>{MASK_EXAMPLE}</span>. It never
                    spells out a full reference or an identity number.
                  </span>
                </li>
                <li>
                  <span>
                    <strong>Look at what it carries.</strong> A real message never includes
                    documents or decisions. Those are only ever inside the secure service.
                  </span>
                </li>
                <li>
                  <span>
                    <strong>Do not follow the link if you are unsure.</strong> Open the app yourself
                    and look in <AppLink href="/messages/">Messages</AppLink>.
                  </span>
                </li>
                <li>
                  <span>
                    <strong>Find it in your secure inbox.</strong> A real notice is always in your
                    secure inbox. If it is not there, treat the message as fake.
                  </span>
                </li>
              </ol>
            </Section>

            <Section title="If something looks wrong" id="wrong">
              <ul className={styles.plainList}>
                <li>
                  <strong>Do not reply, and do not pay.</strong>
                </li>
                <li>
                  <strong>Change nothing.</strong> Do not share a code, reset a password or install
                  anything because a message told you to.
                </li>
              </ul>
              <UnavailableState
                headingLevel={3}
                title="Report suspected fraud (planned)"
                reason="Reporting a suspicious message from inside the app is planned for a later phase, so it cannot be done here yet."
                whatNext="Request a call-back or visit a service point, and tell an adviser what you received."
                actions={
                  <>
                    <LinkButton href="/help/callback/">Request a call-back</LinkButton>
                    <LinkButton href="/service-points/" variant="secondary">
                      Find a service point
                    </LinkButton>
                  </>
                }
              />
            </Section>

            <Section title="Official contact details" id="contacts">
              <Notice tone="neutral">
                <p>
                  The department will publish the official numbers, short codes and addresses here.
                </p>
              </Notice>
            </Section>
          </Stack>
        </div>

        <aside className={styles.aside} aria-label="A moment to check">
          <Photo asset="A50" ratio="4 / 5" className={styles.asidePhoto} sizes="20rem" priority />
          <Eyebrow>Pause before you tap</Eyebrow>
          <p className={styles.small}>
            If a message makes you hesitate, trust that. Close it, open the app yourself and check
            your secure inbox.
          </p>
        </aside>
      </div>
    </Container>
  );
}
