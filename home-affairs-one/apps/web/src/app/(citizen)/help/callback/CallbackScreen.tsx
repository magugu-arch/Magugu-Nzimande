'use client';

import { announce } from '@hao/accessibility';
import type { CreateSupportRequestInput, SupportRequest } from '@hao/api-contracts';
import {
  Button,
  Container,
  LoadingState,
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

/** Sample topics. The real list would come from the contact-centre service owner. */
const TOPICS = [
  'An application in progress',
  'Signing in or verifying my account',
  'Booking or changing an appointment',
  'A payment',
  'Something else',
].map((topic) => ({ value: topic, label: topic }));

const TIMES = ['Morning', 'Afternoon', 'Any time'].map((time) => ({ value: time, label: time }));

const FIELD = {
  topic: 'callback-topic',
  caseId: 'callback-case',
  detail: 'callback-detail',
  time: 'callback-time',
  channel: 'callback-channel',
} as const;

function CallbackForm({
  citizen,
  initialCase,
  onDone,
}: {
  citizen: SupportCitizen;
  initialCase: string | null;
  onDone: (request: SupportRequest) => void;
}) {
  const signedIn = citizen.token !== null;

  const [topic, setTopic] = useState('');
  const [caseId, setCaseId] = useState(initialCase ?? '');
  const [detail, setDetail] = useState('');
  const [time, setTime] = useState('');
  const [channel, setChannel] = useState('');
  const [share, setShare] = useState(false);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);

  // One key for this request: a retry after a failure cannot create a second one.
  const [idempotencyKey] = useState(() => newIdempotencyKey('support-callback'));
  const create = useGatewayMutation((g, input: CreateSupportRequestInput) =>
    g.support.createRequest(input, { idempotencyKey }),
  );

  // After a failed submit, move to the summary so the problems are read out first.
  useEffect(() => {
    if (failedSubmits > 0) summaryRef.current?.focus();
  }, [failedSubmits]);

  // Only an application that is really in the person's list counts as chosen.
  const chosenCase = citizen.cases.find((item) => item.caseId === caseId) ?? null;

  const clearError = (field: string) =>
    setErrors((current) => current.filter((error) => error.field !== field));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = detail.trim();
    const contactChannel = toContactChannel(channel, signedIn);
    const found: FieldError[] = [];
    if (!topic) found.push({ field: FIELD.topic, message: 'Choose what you need help with' });
    if (!text) {
      found.push({ field: FIELD.detail, message: 'Tell us briefly what is happening' });
    } else if (looksLikeSensitiveNumber(text)) {
      found.push({
        field: FIELD.detail,
        message: 'Remove long numbers such as ID numbers, document numbers or one-time PINs',
      });
    }
    if (!time) found.push({ field: FIELD.time, message: 'Choose a time that suits you' });
    if (!contactChannel) {
      found.push({ field: FIELD.channel, message: 'Choose how we should reach you' });
    }
    setErrors(found);
    if (found.length > 0 || !contactChannel) {
      setFailedSubmits((count) => count + 1);
      return;
    }

    create.mutate(
      {
        kind: 'CALLBACK',
        personToken: citizen.token ?? null,
        caseId: chosenCase?.caseId ?? null,
        topic,
        detail: text,
        preferredTime: time,
        contactChannel,
        // Context is only ever shared for a chosen application, and only with a tick.
        shareContext: chosenCase !== null && share,
      },
      {
        onSuccess: (request) => {
          announce(`Call-back requested. Your request reference is ${request.requestId}.`);
          onDone(request);
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        back={{ href: '/help/', label: 'Get help' }}
        title="Request a call-back"
        lede="Tell us what you need and when suits you. An adviser will pick it up — you will not have to explain it all again."
      />
      <form className={styles.form} onSubmit={submit} noValidate>
        <ErrorSummary errors={errors} ref={summaryRef} />

        <div id={FIELD.topic}>
          <Select
            label="What do you need help with?"
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
          label="Tell us briefly what is happening"
          value={detail}
          onChange={(next) => {
            setDetail(next);
            clearError(FIELD.detail);
          }}
          error={errorFor(errors, FIELD.detail)}
        />

        <div id={FIELD.time}>
          <RadioGroup
            legend="When is a good time?"
            name="callback-time"
            value={time}
            onChange={(next) => {
              setTime(next);
              clearError(FIELD.time);
            }}
            options={TIMES}
            error={errorFor(errors, FIELD.time)}
          />
        </div>

        <div id={FIELD.channel}>
          <RadioGroup
            legend="How should we reach you?"
            name="callback-channel"
            value={channel}
            onChange={(next) => {
              setChannel(next);
              clearError(FIELD.channel);
            }}
            options={contactOptions(signedIn)}
            error={errorFor(errors, FIELD.channel)}
          />
        </div>
        {signedIn ? null : <SignedOutContactNote next="/help/callback/" />}

        <p className={styles.promise}>
          An adviser will never ask for your password or one-time PIN, and will confirm who you are
          before discussing anything personal.
        </p>

        {create.isError ? <SendFailed error={create.error} /> : null}
        <div>
          <Button type="submit" size="lg" loading={create.isPending}>
            Request a call-back
          </Button>
        </div>
      </form>
    </>
  );
}

export function CallbackScreen() {
  const caseParam = useSearchParams().get('case');
  const citizen = useSupportCitizen();
  const [sent, setSent] = useState<SupportRequest | null>(null);
  // A new round is a new intent: the form starts empty with a fresh idempotency key.
  const [round, setRound] = useState(0);

  return (
    <Container width="narrow">
      <Stack gap={7} className={styles.page}>
        {sent ? (
          <div>
            <PageHeader back={{ href: '/help/', label: 'Get help' }} title="Call-back requested" />
            <RequestConfirmation
              request={sent}
              title="We have your request"
              actions={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSent(null);
                    setRound((count) => count + 1);
                  }}
                >
                  Request another call-back
                </Button>
              }
            >
              <ul>
                <li>An adviser will contact you the way you chose.</li>
                <li>
                  They will confirm who you are with a step-up check before they look up or discuss
                  an application.
                </li>
                <li>
                  They will never ask for your password or one-time PIN, or for a payment to a
                  personal account.
                </li>
                <li>You do not need to stay on this page. Your request is saved.</li>
              </ul>
            </RequestConfirmation>
          </div>
        ) : citizen.ready ? (
          <div>
            <CallbackForm key={round} citizen={citizen} initialCase={caseParam} onDone={setSent} />
          </div>
        ) : (
          <div>
            <PageHeader back={{ href: '/help/', label: 'Get help' }} title="Request a call-back" />
            <LoadingState label="Loading the call-back form" rows={3} />
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
