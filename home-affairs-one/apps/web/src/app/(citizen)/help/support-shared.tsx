'use client';

import { focusMainHeading } from '@hao/accessibility';
import type { ApplicationCase, SupportRequest } from '@hao/api-contracts';
import {
  AppLink,
  Checkbox,
  DescriptionList,
  LinkButton,
  Notice,
  Select,
  Tag,
  Textarea,
  type RadioGroupProps,
  type Tone,
} from '@hao/design-system';
import { maskReference, meetsTier, type GatewayError } from '@hao/shared-types';
import { useEffect, type ReactNode, type Ref } from 'react';
import { QueryBoundary } from '@/components/QueryBoundary';
import { formatDate } from '@/lib/format';
import { useGatewayQuery } from '@/lib/queries';
import { useSession } from '@/lib/session';
import styles from './support.module.css';

/** Pieces shared by the call-back form and the complaint / feedback form. */

export type ContactChannel = SupportRequest['contactChannel'];

export const DETAIL_LIMIT = 1000;
export const DETAIL_HINT = 'Do not include ID numbers, document numbers or one-time PINs.';

export const KIND_WORDS: Record<SupportRequest['kind'], string> = {
  CALLBACK: 'Call-back',
  COMPLAINT: 'Complaint',
  FEEDBACK: 'Feedback',
};

const STATUS_WORDS: Record<SupportRequest['status'], { label: string; tone: Tone }> = {
  RECEIVED: { label: 'Received', tone: 'info' },
  IN_PROGRESS: { label: 'With an adviser', tone: 'attention' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
};

const CHANNEL_WORDS: Record<ContactChannel, string> = {
  PHONE: 'Phone call',
  EMAIL: 'Email',
  SECURE_INBOX: 'Message in your secure inbox',
};

export function caseHref(caseId: string): string {
  return `/applications/case/?id=${encodeURIComponent(caseId)}`;
}

/* The person asking ------------------------------------------------- */

export interface SupportCitizen {
  /** False until the session has been read in the browser. */
  ready: boolean;
  /** The signed-in citizen's token, or `null` when signed out. */
  token: string | null;
  /** The citizen's applications. Empty when signed out, not verified, or unavailable. */
  cases: ApplicationCase[];
}

/**
 * Who is filling in the form. These pages are public, so everything here
 * degrades to "nobody signed in": no token, no applications to choose from.
 */
export function useSupportCitizen(): SupportCitizen {
  const { session, ready } = useSession();
  const signedIn = session?.role === 'citizen';
  const token = signedIn ? session.subjectRef : null;
  const verified = signedIn && meetsTier(session.tier, 'A2');
  const cases = useGatewayQuery(['cases', token], (g) => g.workflow.listCases(token ?? ''), {
    enabled: Boolean(token) && verified,
  });
  // If the list cannot be loaded the form simply leaves the application field out.
  return { ready, token, cases: verified && cases.isSuccess ? cases.data : [] };
}

/* Errors ------------------------------------------------------------ */

export interface FieldError {
  /** The `id` of the element wrapped around the field. */
  field: string;
  message: string;
}

/** Moves focus to the first control inside a field's wrapper. */
export function focusField(wrapperId: string): void {
  document
    .getElementById(wrapperId)
    ?.querySelector<HTMLElement>('select, textarea, input')
    ?.focus();
}

export function errorFor(errors: FieldError[], field: string): string | null {
  return errors.find((error) => error.field === field)?.message ?? null;
}

/** A long run of digits is probably an ID number, document number or one-time PIN. */
export function looksLikeSensitiveNumber(text: string): boolean {
  return /\d{6,}/.test(text);
}

/**
 * Lists what needs fixing, above the form. The form moves focus here after a
 * failed submit; each item jumps to its field.
 */
export function ErrorSummary({ errors, ref }: { errors: FieldError[]; ref?: Ref<HTMLDivElement> }) {
  if (errors.length === 0) return null;
  return (
    <div
      ref={ref}
      className={styles.summary}
      tabIndex={-1}
      role="group"
      aria-labelledby="form-error-summary"
    >
      <h2 id="form-error-summary" className={styles.summaryTitle}>
        {errors.length === 1 ? 'There is a problem' : `There are ${errors.length} problems`}
      </h2>
      <ul>
        {errors.map((error) => (
          <li key={error.field}>
            <button
              type="button"
              className={styles.summaryLink}
              onClick={() => focusField(error.field)}
            >
              {error.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A failed send, shown beside the submit button. */
export function SendFailed({ error }: { error: GatewayError }) {
  return (
    <Notice tone="danger" role="alert" title="We could not send this">
      <p>{error.safeMessage}</p>
      <p>Nothing was lost. You can try again.</p>
      <p className={styles.trace}>Reference for support: {error.traceRef}</p>
    </Notice>
  );
}

/* Fields ------------------------------------------------------------ */

function spokenCount(remaining: number): string {
  if (remaining > 100) return '';
  if (remaining === 0) return `You have reached the limit of ${DETAIL_LIMIT} characters.`;
  if (remaining <= 10) return `${remaining} characters left.`;
  // Only changes every ten characters, so a screen reader is not interrupted on each key.
  return `${Math.ceil(remaining / 10) * 10} characters or fewer left.`;
}

/** The free-text message, with a live count of the characters remaining. */
export function DetailField({
  wrapperId,
  label,
  value,
  onChange,
  error,
}: {
  wrapperId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}) {
  const remaining = DETAIL_LIMIT - value.length;
  return (
    <div id={wrapperId} className={styles.detail}>
      <Textarea
        label={label}
        hint={DETAIL_HINT}
        rows={5}
        maxLength={DETAIL_LIMIT}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error}
      />
      <p className={styles.count}>
        {remaining} of {DETAIL_LIMIT} characters remaining
      </p>
      <p className="visually-hidden" role="status">
        {spokenCount(remaining)}
      </p>
    </div>
  );
}

/** Contact options. The secure inbox is only offered to someone who is signed in. */
export function contactOptions(signedIn: boolean): RadioGroupProps['options'] {
  const options: RadioGroupProps['options'] = [
    { value: 'PHONE', label: signedIn ? 'Phone call to my verified number' : 'Phone call' },
    { value: 'EMAIL', label: 'Email' },
  ];
  if (signedIn) options.push({ value: 'SECURE_INBOX', label: 'Message in my secure inbox' });
  return options;
}

export function toContactChannel(value: string, signedIn: boolean): ContactChannel | null {
  if (value === 'PHONE' || value === 'EMAIL') return value;
  if (value === 'SECURE_INBOX' && signedIn) return value;
  return null;
}

/** Shown to someone who is not signed in: the prototype has no way to reach them. */
export function SignedOutContactNote({ next }: { next: string }) {
  return (
    <Notice tone="neutral" title="You are not signed in">
      <p>
        This prototype does not collect a phone number or an email address, so nobody will actually
        contact you. The real service would confirm how to reach you at this step.
      </p>
      <p>
        <AppLink href={`/sign-in/?next=${encodeURIComponent(next)}`}>Sign in</AppLink> to use your
        verified contact details and your secure inbox.
      </p>
    </Notice>
  );
}

/**
 * Optional link to one of the person's applications, and — only once one is
 * chosen — an explicit, unticked consent to pass minimal context to the adviser.
 */
export function CaseContextFields({
  wrapperId,
  cases,
  caseId,
  onCaseChange,
  share,
  onShareChange,
}: {
  wrapperId: string;
  cases: ApplicationCase[];
  /** The chosen application, or `''` for none. */
  caseId: string;
  onCaseChange: (caseId: string) => void;
  share: boolean;
  onShareChange: (share: boolean) => void;
}) {
  if (cases.length === 0) return null;
  return (
    <>
      <div id={wrapperId}>
        <Select
          label="Which application?"
          optional
          placeholder="No specific application"
          options={cases.map((item) => ({
            value: item.caseId,
            label: `${item.serviceTitle} — reference ${maskReference(item.caseId)}`,
          }))}
          value={caseId}
          onChange={(event) => onCaseChange(event.target.value)}
        />
      </div>
      {caseId ? (
        <Checkbox
          card
          label="Share this application’s context with the adviser"
          hint={`A masked reference (${maskReference(caseId)}) and one line saying you asked for help with it. Nothing else — not your message above, not your documents.`}
          checked={share}
          onChange={(event) => onShareChange(event.target.checked)}
        />
      ) : null}
    </>
  );
}

/* Confirmation ------------------------------------------------------ */

function sharedWords(request: SupportRequest): string {
  const { consented, caseToken, summary } = request.sharedContext;
  if (!consented || !caseToken) return 'Nothing was shared beyond your contact choice';
  return `Shared with the adviser: reference ${caseToken}${summary ? ` and this line — “${summary}”` : ''}`;
}

/**
 * The facts of a request that was just sent: its reference, what the person
 * chose and exactly what was passed to the adviser. Moves focus to the page
 * heading, which the screen has changed to say the request was received.
 */
export function RequestConfirmation({
  request,
  title,
  children,
  actions,
}: {
  request: SupportRequest;
  /** Bold line at the top of the confirmation, e.g. "We have your request". */
  title: string;
  /** "What happens next" — plain words, no timeframes. */
  children: ReactNode;
  actions: ReactNode;
}) {
  useEffect(() => {
    focusMainHeading();
  }, []);

  return (
    <div className={styles.confirmation}>
      <Notice tone="success" role="status" title={title}>
        <p>
          Your request reference is <strong>{request.requestId}</strong>. This is a demo reference;
          nothing has left this device.
        </p>
      </Notice>
      <DescriptionList
        items={[
          { term: 'Request reference', description: request.requestId },
          { term: 'About', description: request.topic },
          ...(request.preferredTime
            ? [{ term: 'Good time to reach you', description: request.preferredTime }]
            : []),
          { term: 'How we will reach you', description: CHANNEL_WORDS[request.contactChannel] },
          { term: 'What was shared', description: sharedWords(request) },
        ]}
      />
      <section className={styles.next} aria-labelledby="next-heading">
        <h2 id="next-heading">What happens next</h2>
        {children}
      </section>
      <div className={styles.actions}>
        {actions}
        {request.caseId ? (
          <LinkButton href={caseHref(request.caseId)} variant="secondary">
            Go to the application
          </LinkButton>
        ) : null}
        <LinkButton href="/help/" variant="quiet">
          Back to help
        </LinkButton>
      </div>
    </div>
  );
}

/* Recent requests --------------------------------------------------- */

/** The signed-in person's own requests, newest first. */
export function RecentRequests({ token }: { token: string }) {
  const requests = useGatewayQuery(['requests', token], (g) => g.support.listRequests(token));
  return (
    <QueryBoundary
      query={requests}
      loadingLabel="Loading your recent requests"
      loadingRows={2}
      headingLevel={3}
      isEmpty={(items) => items.length === 0}
      empty={<Notice tone="neutral">You have not sent any requests yet.</Notice>}
    >
      {(items) => (
        <ul className={styles.requests}>
          {items.slice(0, 5).map((item) => (
            <li key={item.requestId}>
              <p className={styles.requestTopic}>{item.topic}</p>
              <p className={styles.requestMeta}>
                <Tag>{KIND_WORDS[item.kind]}</Tag>
                <Tag tone={STATUS_WORDS[item.status].tone}>{STATUS_WORDS[item.status].label}</Tag>
                <span>Sent {formatDate(item.createdAt)}</span>
                {item.caseId ? <span>About application {maskReference(item.caseId)}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </QueryBoundary>
  );
}
