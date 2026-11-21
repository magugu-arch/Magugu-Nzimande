'use client';

import { announce } from '@hao/accessibility';
import type { PersonAccount } from '@hao/api-contracts';
import { createStubPasskeyAuthenticator } from '@hao/auth-client';
import {
  AppLink,
  Avatar,
  Button,
  Card,
  Container,
  Disclosure,
  Eyebrow,
  Notice,
  PageHeader,
  Spinner,
  Stack,
  Tag,
  TextInput,
} from '@hao/design-system';
import { ASSURANCE_TIER_INFO } from '@hao/shared-types';
import { ChevronRight, Fingerprint, KeyRound } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { useGatewayQuery } from '@/lib/queries';
import { useSession } from '@/lib/session';
import styles from './sign-in.module.css';

type Step = 'choose' | 'method' | 'passkey';

/** Only follow `next` to a page inside this app. */
function safeNext(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value;
  return '/home/';
}

const passkeys = createStubPasskeyAuthenticator();

export function SignInScreen() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const { signInCitizen } = useSession();
  const personas = useGatewayQuery(['personas'], (g) => g.identity.listDemoPersonas());

  const [step, setStep] = useState<Step>('choose');
  const [account, setAccount] = useState<PersonAccount | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const choose = (persona: PersonAccount) => {
    setAccount(persona);
    setStep('method');
    setCode('');
    setCodeError(null);
  };

  const signInWithPasskey = async () => {
    if (!account) return;
    setStep('passkey');
    announce('Waiting for your device to confirm it is you.');
    await passkeys.authenticate(account.personToken);
    signInCitizen(account, 'passkey');
    announce(`Signed in as ${account.displayName}.`);
    router.push(next);
  };

  const signInWithCode = (event: FormEvent) => {
    event.preventDefault();
    if (!account) return;
    if (!/^\d{6}$/.test(code)) {
      setCodeError('Enter the 6-digit code. In this demo any six digits work.');
      return;
    }
    signInCitizen(account, 'verified-contact');
    announce(`Signed in as ${account.displayName} with basic access.`);
    router.push(next);
  };

  const email = account?.contacts.find((contact) => contact.channel === 'EMAIL');

  return (
    <Container>
      <div className={styles.layout}>
        <div>
          <PageHeader
            eyebrow="Demo sign-in"
            title={step === 'choose' ? 'Choose who to sign in as' : 'Confirm it is you'}
            lede={
              step === 'choose'
                ? 'Each person below is invented, with their own applications and messages, so you can see the service from different points of view.'
                : undefined
            }
            back={
              step === 'choose' ? undefined : { href: '/sign-in/', label: 'Choose someone else' }
            }
          />
          <Stack gap={5}>
            <Notice tone="neutral" title="This is a mock sign-in">
              <p>
                No password or real passkey is checked, and nobody’s identity is verified. A real
                service would use the department’s approved identity provider.
              </p>
            </Notice>

            {step === 'choose' ? (
              <QueryBoundary query={personas} loadingLabel="Loading demo people" loadingRows={4}>
                {(people) => (
                  <ul className={styles.personas}>
                    {people.map((person) => (
                      <li key={person.personToken}>
                        <button
                          type="button"
                          className={styles.persona}
                          onClick={() => choose(person)}
                        >
                          <Avatar initials={person.initials} size="lg" tone="gold" />
                          <span>
                            <span className={styles.personaName}>{person.displayName}</span>
                            <span className={styles.personaSummary}>{person.personaSummary}</span>
                            <span className={styles.personaTags}>
                              <Tag tone={person.assuranceTier === 'A1' ? 'neutral' : 'success'}>
                                {ASSURANCE_TIER_INFO[person.assuranceTier].label}
                              </Tag>
                              {person.residency === 'ABROAD' ? (
                                <Tag tone="teal">Living abroad</Tag>
                              ) : null}
                              {person.residency === 'VISITOR' ? (
                                <Tag tone="teal">Visitor</Tag>
                              ) : null}
                            </span>
                          </span>
                          <ChevronRight aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </QueryBoundary>
            ) : null}

            {step !== 'choose' && account ? (
              <>
                <div className={styles.who}>
                  <Avatar initials={account.initials} size="lg" tone="gold" />
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>
                      {account.displayName}
                    </p>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      {account.personaSummary}
                    </p>
                  </div>
                </div>

                {step === 'passkey' ? (
                  <Card tone="info" role="status">
                    <div className={styles.waiting}>
                      <Photo
                        asset="A11"
                        ratio="1 / 1"
                        shape="circle"
                        className={styles.passkeyPhoto}
                        sizes="6rem"
                        decorative
                      />
                      <Stack gap={2}>
                        <h2 style={{ fontSize: 'var(--text-xl)' }}>Waiting for your device</h2>
                        <p>Use your fingerprint, face or screen lock when your phone asks.</p>
                        <Spinner label="Checking" />
                      </Stack>
                    </div>
                  </Card>
                ) : (
                  <div className={styles.methods}>
                    {account.passkeyRegistered ? (
                      <Card className={styles.method}>
                        <h3>
                          <Fingerprint aria-hidden="true" />
                          Use your passkey
                        </h3>
                        <p>
                          The quickest and safest way in. Your device confirms it is you; nothing
                          secret is typed or sent.
                        </p>
                        <div>
                          <Button onClick={() => void signInWithPasskey()} size="lg">
                            Continue with passkey
                          </Button>
                        </div>
                      </Card>
                    ) : (
                      <Notice tone="info" title="No passkey on this account yet">
                        <p>
                          This person signs in with a one-time code, which gives basic access. A
                          passkey can be added from Profile.
                        </p>
                      </Notice>
                    )}

                    <Card className={styles.method}>
                      <h3>
                        <KeyRound aria-hidden="true" />
                        Use a one-time code
                      </h3>
                      <p>
                        We send a code to a contact you have already verified
                        {email ? ` (${email.maskedValue})` : ''}. This gives{' '}
                        <strong>basic access</strong>: you can browse and save drafts, but not see
                        your applications.
                      </p>
                      <form onSubmit={signInWithCode} noValidate>
                        <div className={styles.codeRow}>
                          <TextInput
                            label="6-digit code"
                            hint="Demo: type any six digits."
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={code}
                            onChange={(event) => {
                              setCode(event.target.value.replace(/\D/g, ''));
                              setCodeError(null);
                            }}
                            error={codeError}
                          />
                          <Button type="submit" variant="secondary">
                            Sign in with code
                          </Button>
                        </div>
                      </form>
                    </Card>
                  </div>
                )}
              </>
            ) : null}

            <Disclosure summary="Cannot sign in, or lost your phone?">
              <p>
                Account recovery is deliberately careful, because your account protects your
                identity.
              </p>
              <ol className={styles.steps}>
                <li>Confirm a contact you verified earlier.</li>
                <li>
                  Answer a stronger check, or visit a service point where an adviser can confirm who
                  you are.
                </li>
                <li>Set up a new passkey. Old devices are signed out.</li>
              </ol>
              <p>
                We will never ask for your password or one-time PIN by phone, WhatsApp, SMS or
                email. <AppLink href="/help/">Get help signing in</AppLink>.
              </p>
            </Disclosure>

            <p className={styles.other}>
              <AppLink href="/staff/">Staff console sign-in</AppLink>
              <AppLink href="/partner/">Partner sandbox sign-in</AppLink>
            </p>
          </Stack>
        </div>

        <aside className={styles.aside} aria-label="About signing in">
          <div className={styles.asideCard}>
            <Photo
              asset={step === 'choose' ? 'A06' : 'A14'}
              ratio="4 / 5"
              shape="arch"
              className={styles.asidePhoto}
              sizes="20rem"
              priority
            />
            <Eyebrow>Signing in is not proof of identity</Eyebrow>
            <p style={{ color: 'var(--color-text-muted)' }}>
              A passkey shows you control this account. How much you can do depends on how strongly
              your identity has been checked — and sensitive steps ask for a fresh check each time.
            </p>
            <Card tone="sunken" padding="compact">
              <Stack gap={2}>
                <Photo asset="A48" ratio="16 / 9" sizes="22rem" />
                <p style={{ fontSize: 'var(--text-sm)' }}>
                  <strong>Prefer a person?</strong> An adviser at a service point can help you
                  verify your account while you keep hold of your own phone.
                </p>
              </Stack>
            </Card>
          </div>
        </aside>
      </div>
    </Container>
  );
}
