'use client';

import { announce } from '@hao/accessibility';
import type { Contact, PersonAccount } from '@hao/api-contracts';
import { STEP_UP_MINUTES } from '@hao/auth-client';
import {
  Button,
  Card,
  Container,
  LinkButton,
  Notice,
  PageHeader,
  Section,
  Stack,
  Tag,
  cx,
} from '@hao/design-system';
import { ASSURANCE_TIER_INFO, meetsTier, type AssuranceTier } from '@hao/shared-types';
import { CircleCheck, Clock3, Fingerprint, MapPin, MapPinned } from 'lucide-react';
import { useEffect, useReducer, useState } from 'react';
import { QueryBoundary } from '@/components/QueryBoundary';
import { formatDate, formatTime } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useGatewayMutation, useGatewayQuery } from '@/lib/queries';
import { useSession } from '@/lib/session';
import styles from '../profile.module.css';
import { CONTACT_ICON, CONTACT_LABEL, VerifiedTag, currentTier, isPast } from '../shared';

/** The four levels a member of the public can hold. A4 is a separate workforce level. */
const CITIZEN_TIERS: readonly AssuranceTier[] = ['A0', 'A1', 'A2', 'A3'];

type ContactChannel = Contact['channel'];

/** What recovery still needs, worked out from the account. Mirrors the mock's rule. */
function missingForRecovery(account: PersonAccount): string[] {
  const missing: string[] = [];
  if (!account.passkeyRegistered) missing.push('Add a passkey.');
  if (account.contacts.filter((contact) => contact.verified).length < 2) {
    missing.push('Verify a second way to reach you, so one lost contact does not lock you out.');
  }
  return missing;
}

export function SecurityScreen() {
  const { session } = useSession();
  const token = session?.subjectRef ?? '';
  const account = useGatewayQuery(['account', token], (g) => g.identity.getAccount(token), {
    enabled: Boolean(token),
  });

  // One key per intent: adding the passkey, and verifying each contact. Each can
  // only happen once on this screen, so a retry reuses the same key.
  const [keys] = useState(() => ({
    passkey: newIdempotencyKey('register-passkey'),
    EMAIL: newIdempotencyKey('verify-contact'),
    SMS: newIdempotencyKey('verify-contact'),
    WHATSAPP: newIdempotencyKey('verify-contact'),
  }));
  const [justVerified, setJustVerified] = useState<ContactChannel | null>(null);
  const [passkeyAdded, setPasskeyAdded] = useState(false);

  const addPasskey = useGatewayMutation((g, idempotencyKey: string) =>
    g.identity.registerPasskey(token, { idempotencyKey }),
  );
  const verify = useGatewayMutation((g, channel: ContactChannel) =>
    g.identity.verifyContact(token, channel, { idempotencyKey: keys[channel] }),
  );

  // Re-render when a step-up runs out, so "active now" never lingers.
  const stepUpExpiresAt = session?.stepUpExpiresAt ?? null;
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    if (!stepUpExpiresAt) return;
    const remaining = new Date(stepUpExpiresAt).getTime() - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(refresh, remaining + 250);
    return () => window.clearTimeout(timer);
  }, [stepUpExpiresAt]);

  if (!session) return null;
  const tier = currentTier(session);
  const stepUpActive = stepUpExpiresAt !== null && !isPast(stepUpExpiresAt);
  const signedInBelowAccount = meetsTier(session.accountTier, 'A2') && !meetsTier(tier, 'A2');

  const registerPasskey = () => {
    addPasskey.mutate(keys.passkey, {
      onSuccess: () => {
        setPasskeyAdded(true);
        announce('Passkey added to this demo account. No real passkey was created.');
      },
    });
  };

  const verifyContact = (channel: ContactChannel) => {
    setJustVerified(null);
    verify.mutate(channel, {
      onSuccess: () => {
        setJustVerified(channel);
        announce(`${CONTACT_LABEL[channel]} marked as verified. No code was sent.`);
      },
    });
  };

  return (
    <Container width="narrow">
      <PageHeader
        eyebrow="Profile"
        title="Sign-in and security"
        lede="How you sign in, how strongly your identity has been checked, and how to get back in if you lose your phone."
        back={{ href: '/profile/', label: 'Profile' }}
      />

      <Stack gap={7}>
        <Section title="Your level" id="level">
          <Stack gap={4}>
            <p>
              Signing in is not proof of identity. Signing in to an account, having your identity
              checked, and having authority to act for someone else are three different things — and
              each sensitive step asks for the one it needs.
            </p>

            <ol className={styles.ladder}>
              {CITIZEN_TIERS.map((code) => {
                const info = ASSURANCE_TIER_INFO[code];
                const here = code === tier;
                return (
                  <li
                    key={code}
                    className={cx(styles.rung, here && styles.rungHere)}
                    aria-current={here ? 'step' : undefined}
                  >
                    <span className={styles.rungCode} aria-hidden="true">
                      {code}
                    </span>
                    <div className={styles.rungBody}>
                      <div className={styles.rungHead}>
                        <h3>
                          {info.label}
                          <span className="visually-hidden"> (level {code})</span>
                        </h3>
                        {here ? (
                          <Tag tone="brand" icon={<MapPin aria-hidden="true" />}>
                            You are here
                          </Tag>
                        ) : null}
                      </div>
                      <p>{info.summary}</p>
                      <p className={styles.rungExamples}>For example: {info.examples}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <p className={styles.small}>
              Staff and institutions do not sit on this ladder. They use a separate level (
              {ASSURANCE_TIER_INFO.A4.label}, A4): an official role with access limited to a stated
              purpose, and every action recorded.
            </p>

            {signedInBelowAccount ? (
              <Notice tone="info" title="Your account is verified, but this sign-in is basic">
                <p>
                  You signed in with a one-time code, which only gives basic access. Sign in with
                  your passkey to use your verified account.
                </p>
                <p>
                  <LinkButton href="/sign-in/" variant="secondary" size="sm">
                    Sign in again
                  </LinkButton>
                </p>
              </Notice>
            ) : null}

            {!meetsTier(session.accountTier, 'A2') ? (
              <Card tone="sunken">
                <Stack gap={3}>
                  <h3>Moving up to a verified account</h3>
                  <p>
                    A verified account needs your identity to be checked in a way Home Affairs
                    approves — for example in person at a service point. How that check will work is
                    not decided yet, so this prototype cannot do it for you.
                  </p>
                  <p>
                    To see the verified experience, sign in as one of the other demo people. An
                    adviser at a service point can also help with any step.
                  </p>
                  <div className={styles.links}>
                    <LinkButton href="/sign-in/" variant="secondary">
                      Choose another demo person
                    </LinkButton>
                    <LinkButton
                      href="/service-points/"
                      variant="quiet"
                      iconStart={<MapPinned aria-hidden="true" />}
                    >
                      Find a service point
                    </LinkButton>
                  </div>
                </Stack>
              </Card>
            ) : null}
          </Stack>
        </Section>

        <Section title="Passkey" id="passkey">
          <QueryBoundary query={account} loadingLabel="Loading your passkey status" loadingRows={1}>
            {(person) =>
              person.passkeyRegistered ? (
                <Stack gap={3}>
                  <Notice
                    tone="success"
                    role={passkeyAdded ? 'status' : 'note'}
                    title="A passkey is set up on this account."
                  >
                    <p>
                      Your device confirms it is you with your fingerprint, face or screen lock.
                      Nothing secret is typed or sent.
                    </p>
                  </Notice>
                  {passkeyAdded ? (
                    <Notice tone="neutral" title="This was a demonstration">
                      <p>
                        No real passkey was created and nothing was stored on your device. The demo
                        account now simply records that one exists. Sign in again to use it.
                      </p>
                    </Notice>
                  ) : null}
                </Stack>
              ) : (
                <Card>
                  <Stack gap={3}>
                    <h3>No passkey yet</h3>
                    <p>
                      A passkey is the safest way to sign in. Your device confirms it is you, so
                      there is no password to remember, share or have stolen. It makes signing in
                      safer; it does not raise your level by itself.
                    </p>
                    <Notice tone="neutral" title="Demo only">
                      <p>
                        This button records that a passkey exists on the demo account. No real
                        passkey is created and your device is not asked for anything.
                      </p>
                    </Notice>
                    {addPasskey.isError ? (
                      <Notice tone="danger" role="alert" title="The passkey was not added">
                        <p>{addPasskey.error.safeMessage}</p>
                        <p>Reference for support: {addPasskey.error.traceRef}</p>
                      </Notice>
                    ) : null}
                    <div>
                      <Button
                        onClick={registerPasskey}
                        loading={addPasskey.isPending}
                        iconStart={<Fingerprint aria-hidden="true" />}
                      >
                        Add a passkey (demo)
                      </Button>
                    </div>
                  </Stack>
                </Card>
              )
            }
          </QueryBoundary>
        </Section>

        <Section
          title="Verified contacts"
          id="contacts"
          intro="A verified contact is one we have confirmed reaches you. It is how we send sign-in codes and help you recover your account."
        >
          <QueryBoundary
            query={account}
            loadingLabel="Loading your contacts"
            loadingRows={2}
            isEmpty={(person) => person.contacts.length === 0}
            empty={
              <Notice tone="neutral">
                <p>No contact details are held for this account.</p>
              </Notice>
            }
          >
            {(person) => (
              <Card>
                <Stack gap={3}>
                  <ul className={styles.contacts}>
                    {person.contacts.map((contact) => {
                      const busy = verify.isPending && verify.variables === contact.channel;
                      const failed = verify.isError && verify.variables === contact.channel;
                      return (
                        <li key={contact.channel} className={styles.contact}>
                          <span className={styles.contactIcon}>
                            {CONTACT_ICON[contact.channel]}
                          </span>
                          <span className={styles.contactText}>
                            <span className={styles.contactLabel}>
                              {CONTACT_LABEL[contact.channel]}
                            </span>
                            <span className={styles.contactValue}>
                              {contact.maskedValue}
                              {contact.verifiedAt
                                ? ` · verified ${formatDate(contact.verifiedAt)}`
                                : ''}
                            </span>
                          </span>
                          <VerifiedTag verified={contact.verified} />
                          {contact.verified ? null : (
                            <div className={styles.contactAction}>
                              {failed ? (
                                <Notice
                                  tone="danger"
                                  role="alert"
                                  title="This contact was not verified"
                                >
                                  <p>{verify.error.safeMessage}</p>
                                  <p>Reference for support: {verify.error.traceRef}</p>
                                </Notice>
                              ) : null}
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={busy}
                                onClick={() => verifyContact(contact.channel)}
                              >
                                Verify (demo)
                                <span className="visually-hidden">
                                  : {CONTACT_LABEL[contact.channel]}
                                </span>
                              </Button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {justVerified ? (
                    <Notice
                      tone="success"
                      role="status"
                      title={`${CONTACT_LABEL[justVerified]} marked as verified`}
                    >
                      <p>This is a demonstration: no code was sent and nothing was checked.</p>
                    </Notice>
                  ) : null}
                  <p className={styles.small}>
                    In a real service, verifying means entering a code sent to that contact. We will
                    never ask for a code by phone, WhatsApp, SMS or email.
                  </p>
                </Stack>
              </Card>
            )}
          </QueryBoundary>
        </Section>

        <Section title="Stronger checks for sensitive steps" id="step-up">
          <Stack gap={3}>
            <p>
              Before you submit an application that changes your identity record, we ask you to
              confirm it is you again — even though you are already signed in. This fresh
              confirmation lasts {STEP_UP_MINUTES} minutes and then ends by itself, so an unlocked
              phone cannot be used to act in your name.
            </p>
            {stepUpActive && stepUpExpiresAt ? (
              <Notice
                tone="info"
                icon={<Clock3 aria-hidden="true" />}
                title="A stronger check is active now"
              >
                <p>
                  It ends at {formatTime(stepUpExpiresAt)}. After that you will be asked again
                  before the next sensitive step.
                </p>
              </Notice>
            ) : (
              <Notice tone="neutral" title="No stronger check is active">
                <p>
                  You will be asked at the moment it is needed, with a clear explanation first.
                  There is nothing to switch on here.
                </p>
              </Notice>
            )}
          </Stack>
        </Section>

        <Section title="If you lose your phone" id="recovery">
          <Stack gap={4}>
            <QueryBoundary
              query={account}
              loadingLabel="Loading your recovery status"
              loadingRows={1}
            >
              {(person) => {
                const missing = missingForRecovery(person);
                return person.recoveryState === 'READY' ? (
                  <Notice
                    tone="success"
                    icon={<CircleCheck aria-hidden="true" />}
                    title="Recovery is set up"
                  >
                    <p>You have a passkey and more than one verified way to reach you.</p>
                  </Notice>
                ) : (
                  <Notice tone="attention" title="Recovery is not fully set up">
                    {missing.length > 0 ? (
                      <>
                        <p>
                          If you lost your phone today, getting back in would be harder. Still to
                          do:
                        </p>
                        <ul className={styles.plainList}>
                          {missing.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p>
                        Something is still missing. An adviser at a service point can help you
                        finish setting up recovery.
                      </p>
                    )}
                  </Notice>
                );
              }}
            </QueryBoundary>

            <p>Recovery is deliberately careful, because your account protects your identity.</p>
            <ol className={styles.steps}>
              <li>Confirm a contact you verified earlier.</li>
              <li>
                Pass a stronger check, or visit a service point where an adviser can confirm who you
                are.
              </li>
              <li>Set up a new passkey. Old devices are signed out.</li>
            </ol>
            <div className={styles.links}>
              <LinkButton
                href="/service-points/"
                variant="secondary"
                iconStart={<MapPinned aria-hidden="true" />}
              >
                Find a service point
              </LinkButton>
              <LinkButton href="/help/" variant="quiet">
                Get help signing in
              </LinkButton>
            </div>
          </Stack>
        </Section>
      </Stack>
    </Container>
  );
}
