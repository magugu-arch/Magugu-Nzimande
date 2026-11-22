'use client';

import { announce } from '@hao/accessibility';
import { DEMO, type Partner, type VerificationRequest } from '@hao/api-contracts';
import {
  Button,
  Card,
  Container,
  DescriptionList,
  LinkButton,
  LoadingState,
  Notice,
  PageHeader,
  Section,
  Select,
  Split,
  Stack,
  Tag,
  TextInput,
  UnavailableState,
} from '@hao/design-system';
import { useState, type FormEvent } from 'react';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { formatDateTime } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useFlags } from '@/lib/prefs';
import { useGatewayMutation, useGatewayQuery } from '@/lib/queries';
import { useSession } from '@/lib/session';
import styles from './partner.module.css';

type Attribute = VerificationRequest['attribute'];

const SCOPE_WORDS: Record<Attribute, string> = {
  IDENTITY_CONFIRMED: 'identity confirmed',
  OVER_18: 'over 18',
  DOCUMENT_STATUS: 'document status',
};

const QUESTIONS: Array<{ value: Attribute; label: string }> = [
  { value: 'IDENTITY_CONFIRMED', label: 'That their identity is confirmed' },
  { value: 'OVER_18', label: 'That they are over 18' },
  { value: 'DOCUMENT_STATUS', label: 'That a document is valid' },
];

const RESULT_WORDS: Record<
  VerificationRequest['result'],
  { tone: 'success' | 'neutral' | 'attention'; words: string; short: string }
> = {
  CONFIRMED: { tone: 'success', words: 'Confirmed: yes.', short: 'Confirmed' },
  NOT_CONFIRMED: { tone: 'neutral', words: 'Not confirmed.', short: 'Not confirmed' },
  REFUSED_NO_CONSENT: {
    tone: 'attention',
    words: 'Refused: there is no live consent from this person for this request.',
    short: 'Refused — no consent',
  },
  REFUSED_OUT_OF_SCOPE: {
    tone: 'attention',
    words: 'Refused: your accreditation does not cover this question.',
    short: 'Refused — out of scope',
  },
};

const SUBJECTS = Object.values(DEMO.persons).map((token) => ({
  value: token,
  label: `${token} (demo person)`,
}));

function scopesInWords(partner: Partner): string {
  return partner.scopes.map((scope) => SCOPE_WORDS[scope]).join(', ');
}

/** Signed-out view: choose a demo partner. No credentials are asked for or checked. */
function PartnerSignIn() {
  const { signInPartner } = useSession();
  const partners = useGatewayQuery(['partners'], (g) => g.identity.listDemoPartners());

  return (
    <Container>
      <PageHeader
        eyebrow="Accredited partners"
        title="Verification sandbox"
        lede="How an accredited institution would check one fact about a person — with their consent, for a stated purpose, and without receiving a copy of anything."
      />
      <Split gap={6}>
        <Stack gap={5}>
          <Notice tone="neutral" title="This is a mock sign-in">
            <p>
              A real integration needs accreditation, federated workforce identity and a signed
              agreement. Nothing here connects to a real institution.
            </p>
          </Notice>
          <Section title="Choose a demo partner" id="partners">
            <QueryBoundary
              query={partners}
              loadingLabel="Loading demo partners"
              loadingRows={2}
              headingLevel={3}
            >
              {(items) => (
                <Stack gap={3}>
                  {items.map((partner) => (
                    <Button
                      key={partner.partnerRef}
                      variant="secondary"
                      size="lg"
                      fullWidth
                      onClick={() => {
                        signInPartner(partner);
                        announce(`Signed in as ${partner.name}.`);
                      }}
                    >
                      {partner.name} — {partner.sector}. May ask: {scopesInWords(partner)}.
                    </Button>
                  ))}
                </Stack>
              )}
            </QueryBoundary>
          </Section>
          <p>
            <LinkButton href="/" variant="quiet">
              Back to the public service
            </LinkButton>
          </p>
        </Stack>
        <div className={styles.hero}>
          <Photo asset="A60" ratio="3 / 2" sizes="(min-width: 60rem) 22rem, 100vw" />
        </div>
      </Split>
    </Container>
  );
}

/** Signed-in view: one question, one yes-or-no answer, and a visible history. */
function PartnerWorkspace({ partnerRef }: { partnerRef: string }) {
  const partners = useGatewayQuery(['partners'], (g) => g.identity.listDemoPartners());
  const history = useGatewayQuery(['verification-requests', partnerRef], (g) =>
    g.identity.listVerificationRequests(partnerRef),
  );

  const [subjectToken, setSubjectToken] = useState<string>(DEMO.persons.thandi);
  const [attribute, setAttribute] = useState<Attribute>('IDENTITY_CONFIRMED');
  const [purpose, setPurpose] = useState('');
  const [consentRef, setConsentRef] = useState('');
  const [purposeError, setPurposeError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationRequest | null>(null);

  const ask = useGatewayMutation((g, idempotencyKey: string) =>
    g.identity.requestVerification(
      {
        partnerRef,
        subjectToken,
        attribute,
        purpose: purpose.trim(),
        consentRef: consentRef.trim() || null,
      },
      { idempotencyKey },
    ),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (purpose.trim().length < 3) {
      setPurposeError('Say in a few words why you need this. The person will see it.');
      return;
    }
    setPurposeError(null);
    // Each press is a new request, so each gets its own key.
    ask.mutate(newIdempotencyKey('verify'), {
      onSuccess: (request) => {
        setResult(request);
        announce(RESULT_WORDS[request.result].words);
      },
    });
  };

  const partner = partners.data?.find((item) => item.partnerRef === partnerRef);
  const outcome = result ? RESULT_WORDS[result.result] : null;

  return (
    <Container>
      <PageHeader
        eyebrow="Accredited partners"
        title="Verification sandbox"
        lede="Ask one question about one person. You get a yes or a no — never their details."
      />
      <Split gap={6}>
        <Stack gap={6}>
          <Section title="Your accreditation" id="accreditation">
            {partner ? (
              <Card>
                <DescriptionList
                  items={[
                    { term: 'Partner', description: partner.name },
                    { term: 'Sector', description: partner.sector },
                    { term: 'May ask about', description: scopesInWords(partner) },
                    { term: 'Reference', description: partner.partnerRef },
                  ]}
                />
              </Card>
            ) : (
              <LoadingState label="Loading your accreditation" rows={1} />
            )}
          </Section>

          <Section title="New verification request" id="request">
            <form className={styles.form} onSubmit={submit} noValidate>
              <Stack gap={4}>
                <Select
                  label="Who is the request about?"
                  hint="People appear as opaque tokens only. The sandbox never shows a name."
                  options={SUBJECTS}
                  value={subjectToken}
                  onChange={(event) => setSubjectToken(event.target.value)}
                />
                <Select
                  label="What do you need to confirm?"
                  hint="All three are listed so you can see a request refused when it is outside your accreditation."
                  options={QUESTIONS}
                  value={attribute}
                  onChange={(event) => setAttribute(event.target.value as Attribute)}
                />
                <TextInput
                  label="Purpose"
                  hint="Shown to the person and recorded."
                  value={purpose}
                  onChange={(event) => {
                    setPurpose(event.target.value);
                    setPurposeError(null);
                  }}
                  error={purposeError}
                />
                <TextInput
                  label="Consent reference"
                  optional
                  hint={`The person gives you this after agreeing in their app. Try ${DEMO.consents.thandiBank} with ${DEMO.persons.thandi} as the demo bank.`}
                  value={consentRef}
                  onChange={(event) => setConsentRef(event.target.value)}
                />
                <div>
                  <Button type="submit" loading={ask.isPending}>
                    Send request
                  </Button>
                </div>
              </Stack>
            </form>

            {ask.error ? (
              <Notice tone="danger" role="alert" title="The request could not be sent">
                <p>{ask.error.safeMessage}</p>
                <p>Reference for support: {ask.error.traceRef}</p>
              </Notice>
            ) : null}

            {result && outcome ? (
              <div className={styles.result}>
                <Notice
                  tone={outcome.tone}
                  role="status"
                  title={<span className={styles.resultWords}>{outcome.words}</span>}
                >
                  <p>
                    Only a yes or no is ever returned. No personal data leaves the service, and the
                    person can see this request.
                  </p>
                  <p>Request {result.requestId}</p>
                </Notice>
              </div>
            ) : null}
          </Section>

          <Section title="Request history" id="history">
            <QueryBoundary
              query={history}
              loadingLabel="Loading your requests"
              loadingRows={2}
              headingLevel={3}
              isEmpty={(items) => items.length === 0}
              empty={
                <Notice tone="neutral">
                  No requests yet. Every request you send is listed here.
                </Notice>
              }
            >
              {(items) => (
                <Stack gap={3}>
                  {[...items]
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .map((item) => (
                      <Card key={item.requestId} padding="compact">
                        <DescriptionList
                          items={[
                            { term: 'When', description: formatDateTime(item.at) },
                            { term: 'About', description: item.subjectToken },
                            { term: 'Question', description: SCOPE_WORDS[item.attribute] },
                            {
                              term: 'Result',
                              description: (
                                <Tag tone={RESULT_WORDS[item.result].tone}>
                                  {RESULT_WORDS[item.result].short}
                                </Tag>
                              ),
                            },
                            {
                              term: 'Consent reference',
                              description: item.consentRef ?? 'None given',
                            },
                          ]}
                        />
                      </Card>
                    ))}
                </Stack>
              )}
            </QueryBoundary>
          </Section>
        </Stack>

        <aside className={styles.aside} aria-label="How verification works">
          <Stack gap={3}>
            <Photo asset="A54" ratio="1 / 1" sizes="(min-width: 60rem) 22rem, 100vw" />
            <h2 className={styles.asideTitle}>Check without a scan</h2>
            <p>
              You ask a question and get an answer, instead of receiving a copy of a document. The
              person agrees first, for a purpose they can read, and can withdraw that consent.
            </p>
            <p>
              Every request is recorded in the audit trail, including the ones that are refused.
            </p>
          </Stack>
        </aside>
      </Split>
    </Container>
  );
}

export function PartnerScreen() {
  const { flags } = useFlags();
  const { session, ready } = useSession();

  if (!flags.partnerIntegrations) {
    return (
      <Container width="narrow">
        <PageHeader eyebrow="Accredited partners" title="Verification sandbox" />
        <UnavailableState
          title="Partner integrations are switched off"
          reason="Checks by accredited institutions are a gated capability. They need accreditation, consent rules and audit to be agreed first."
          whatNext="Switch the feature on in Prototype controls to see the concept."
          actions={
            <>
              <LinkButton href="/profile/prototype/">Open Prototype controls</LinkButton>
              <LinkButton href="/" variant="secondary">
                Back to the public service
              </LinkButton>
            </>
          }
        />
      </Container>
    );
  }

  if (!ready) {
    return (
      <Container width="narrow">
        <h1 className="visually-hidden">Verification sandbox</h1>
        <LoadingState label="Checking your sign-in" rows={2} />
      </Container>
    );
  }

  return session?.role === 'partner' ? (
    <PartnerWorkspace partnerRef={session.subjectRef} />
  ) : (
    <PartnerSignIn />
  );
}
