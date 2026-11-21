'use client';

import { announce } from '@hao/accessibility';
import type { CreateSupportRequestInput, SupportRequest } from '@hao/api-contracts';
import {
  Button,
  Container,
  LoadingState,
  Notice,
  PageHeader,
  RadioGroup,
  Section,
  Select,
  Stack,
} from '@hao/design-system';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useGatewayMutation } from '@/lib/queries';
import {
  CaseContextFields,
  DetailField,
  ErrorSummary,
  RecentRequests,
  RequestConfirmation,
  SendFailed,
  SignedOutContactNote,
  contactOptions,
  errorFor,
  looksLikeSensitiveNumber,
  toContactChannel,
  useSupportCitizen,
  type FieldError,
  type SupportCitizen,
} from '../support-shared';
import styles from '../support.module.css';

type Kind = Extract<SupportRequest['kind'], 'COMPLAINT' | 'FEEDBACK'>;

const KINDS = [
  {
    value: 'COMPLAINT',
    label: 'Make a complaint',
    hint: 'Something went wrong and you want it looked at.',
  },
  {
    value: 'FEEDBACK',
    label: 'Give feedback',
    hint: 'A suggestion, or something that worked well.',
  },
];

/** Sample topics. The real list would come from the complaints service owner. */
const TOPICS = [
  'How I was treated',
  'A delay or no update',
  'The website or app',
  'Accessibility',
  'Something else',
].map((topic) => ({ value: topic, label: topic }));

const FIELD = {
  kind: 'complaint-kind',
  topic: 'complaint-topic',
  caseId: 'complaint-case',
  detail: 'complaint-detail',
  channel: 'complaint-channel',
} as const;

function toKind(value: string): Kind | null {
  return value === 'COMPLAINT' || value === 'FEEDBACK' ? value : null;
}

function ComplaintForm({
  citizen,
  initialCase,
  onDone,
}: {
  citizen: SupportCitizen;
  initialCase: string | null;
  onDone: (request: SupportRequest) => void;
}) {
  const signedIn = citizen.token !== null;

  const [kind, setKind] = useState('');
  const [topic, setTopic] = useState('');
  const [caseId, setCaseId] = useState(initialCase ?? '');
  const [detail, setDetail] = useState('');
  const [channel, setChannel] = useState('');
  const [share, setShare] = useState(false);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);

  // One key for this request: a retry after a failure cannot create a second one.
  const [idempotencyKey] = useState(() => newIdempotencyKey('support-complaint'));
  const create = useGatewayMutation((g, input: CreateSupportRequestInput) =>
    g.support.createRequest(input, { idempotencyKey }),
  );

  // After a failed submit, move to the summary so the problems are read out first.
  useEffect(() => {
    if (failedSubmits > 0) summaryRef.current?.focus();
  }, [failedSubmits]);

  const chosenCase = citizen.cases.find((item) => item.caseId === caseId) ?? null;
  const isFeedback = kind === 'FEEDBACK';

  const clearError = (field: string) =>
    setErrors((current) => current.filter((error) => error.field !== field));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = detail.trim();
    const chosenKind = toKind(kind);
    const contactChannel = toContactChannel(channel, signedIn);
    const found: FieldError[] = [];
    if (!chosenKind) {
      found.push({ field: FIELD.kind, message: 'Choose a complaint or feedback' });
    }
    if (!topic) found.push({ field: FIELD.topic, message: 'Choose what it is about' });
    if (!text) {
      found.push({ field: FIELD.detail, message: 'Tell us what happened' });
    } else if (looksLikeSensitiveNumber(text)) {
      found.push({
        field: FIELD.detail,
        message: 'Remove long numbers such as ID numbers, document numbers or one-time PINs',
      });
    }
    if (!contactChannel) {
      found.push({ field: FIELD.channel, message: 'Choose how we should reply' });
    }
    setErrors(found);
    if (found.length > 0 || !chosenKind || !contactChannel) {
      setFailedSubmits((count) => count + 1);
      return;
    }

    create.mutate(
      {
        kind: chosenKind,
        personToken: citizen.token ?? null,
        caseId: chosenCase?.caseId ?? null,
        topic,
        detail: text,
        preferredTime: null,
        contactChannel,
        // Context is only ever shared for a chosen application, and only with a tick.
        shareContext: chosenCase !== null && share,
      },
      {
        onSuccess: (request) => {
          announce(
            `${request.kind === 'FEEDBACK' ? 'Feedback' : 'Complaint'} received. Your reference is ${request.requestId}.`,
          );
          onDone(request);
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        back={{ href: '/help/', label: 'Get help' }}
        title="Make a complaint or give feedback"
        lede="Tell us what went wrong, or what would make the service better. A person reads every one."
      />
      <Stack gap={5}>
        <Notice tone="info" title="A complaint does not affect your application">
          <p>
            A complaint is how you tell us that something was not good enough, so that it can be
            looked at and put right. It is kept apart from the decision on any application you have.
          </p>
        </Notice>

        <form className={styles.form} onSubmit={submit} noValidate>
          <ErrorSummary errors={errors} ref={summaryRef} />

          <div id={FIELD.kind}>
            <RadioGroup
              legend="What would you like to do?"
              name="complaint-kind"
              value={kind}
              onChange={(next) => {
                setKind(next);
                clearError(FIELD.kind);
              }}
              options={KINDS}
              error={errorFor(errors, FIELD.kind)}
            />
          </div>

          <div id={FIELD.topic}>
            <Select
              label="What is it about?"
              placeholder="Choose one"
              options={TOPICS}
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                clearError(FIELD.topic);
              }}
              error={errorFor(errors, FIELD.topic)}
            />
          </div>

          <CaseContextFields
            wrapperId={FIELD.caseId}
            cases={citizen.cases}
            caseId={chosenCase?.caseId ?? ''}
            onCaseChange={(next) => {
              setCaseId(next);
              // Consent was for one application; a different one needs a fresh tick.
              setShare(false);
            }}
            share={share}
            onShareChange={setShare}
          />

          <DetailField
            wrapperId={FIELD.detail}
            label={isFeedback ? 'Your feedback' : 'Tell us what happened'}
            value={detail}
            onChange={(next) => {
              setDetail(next);
              clearError(FIELD.detail);
            }}
            error={errorFor(errors, FIELD.detail)}
          />

          <div id={FIELD.channel}>
            <RadioGroup
              legend="How should we reply?"
              name="complaint-channel"
              value={channel}
              onChange={(next) => {
                setChannel(next);
                clearError(FIELD.channel);
              }}
              options={contactOptions(signedIn)}
              error={errorFor(errors, FIELD.channel)}
            />
          </div>
          {signedIn ? null : <SignedOutContactNote next="/help/complaint/" />}

          {create.isError ? <SendFailed error={create.error} /> : null}
          <div>
            <Button type="submit" size="lg" loading={create.isPending}>
              {isFeedback ? 'Send feedback' : kind === 'COMPLAINT' ? 'Send complaint' : 'Send'}
            </Button>
          </div>
        </form>
      </Stack>
    </>
  );
}

export function ComplaintScreen() {
  const caseParam = useSearchParams().get('case');
  const citizen = useSupportCitizen();
  const [sent, setSent] = useState<SupportRequest | null>(null);
  // A new round is a new intent: the form starts empty with a fresh idempotency key.
  const [round, setRound] = useState(0);
  const sentFeedback = sent?.kind === 'FEEDBACK';

  return (
    <Container width="narrow">
      <Stack gap={7} className={styles.page}>
        {sent ? (
          <div>
            <PageHeader
              back={{ href: '/help/', label: 'Get help' }}
              title={sentFeedback ? 'Feedback received' : 'Complaint received'}
            />
            <RequestConfirmation
              request={sent}
              title={sentFeedback ? 'Thank you for your feedback' : 'We have your complaint'}
              actions={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSent(null);
                    setRound((count) => count + 1);
                  }}
                >
                  Send another
                </Button>
              }
            >
              <ul>
                <li>A person will read what you wrote.</li>
                <li>If they need to reach you, they will use the contact choice you made.</li>
                <li>Any application you have carries on as normal.</li>
                <li>Keep your reference in case you want to ask about this later.</li>
              </ul>
            </RequestConfirmation>
          </div>
        ) : citizen.ready ? (
          <div>
            <ComplaintForm key={round} citizen={citizen} initialCase={caseParam} onDone={setSent} />
          </div>
        ) : (
          <div>
            <PageHeader
              back={{ href: '/help/', label: 'Get help' }}
              title="Make a complaint or give feedback"
            />
            <LoadingState label="Loading the form" rows={3} />
          </div>
        )}

        {citizen.token ? (
          <Section title="Your recent requests" id="recent">
            <RecentRequests token={citizen.token} />
          </Section>
        ) : null}
      </Stack>
    </Container>
  );
}
