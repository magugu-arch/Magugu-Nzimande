'use client';

import type { ApplicationDraft, ServiceDefinition } from '@hao/api-contracts';
import type { Session } from '@hao/auth-client';
import {
  Container,
  LinkButton,
  LoadingState,
  PageHeader,
  UnavailableState,
} from '@hao/design-system';
import { meetsTier } from '@hao/shared-types';
import { useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { QueryBoundary } from '@/components/QueryBoundary';
import { findService, serviceHref } from '@/lib/catalogue';
import { useGatewayQuery } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { ApplyFlow } from './ApplyFlow';
import styles from './apply.module.css';
import { isOwnDraft } from './flow';

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Container width="narrow" className={styles.page}>
      <PageHeader eyebrow="Application" title={title} />
      {children}
    </Container>
  );
}

/** No service, an unknown one, or one that cannot be applied for online: say why and what next. */
function CannotStart({ code, service }: { code: string | null; service?: ServiceDefinition }) {
  const reason = service
    ? (service.unavailable?.reason ??
      `“${service.title}” cannot be applied for online in this prototype.`)
    : code
      ? 'We do not recognise the service in this link.'
      : 'This link does not say which service to apply for.';

  return (
    <Frame title={service ? service.title : 'Start an application'}>
      <UnavailableState
        title="This service cannot be started here"
        reason={reason}
        whatNext={
          service
            ? (service.unavailable?.whatNext ??
              'Open the service page to see what it involves and the ways you can complete it.')
            : 'Choose a service from the list. Each one says whether you can apply online.'
        }
        alternatives={service?.unavailable?.alternatives}
        actions={
          <>
            {service ? (
              <LinkButton href={serviceHref(service.code)}>Go to the service page</LinkButton>
            ) : (
              <LinkButton href="/services/">Browse services</LinkButton>
            )}
            <LinkButton href="/help/" variant="secondary">
              Get help
            </LinkButton>
          </>
        }
      />
    </Frame>
  );
}

/** The draft is gone, or it belongs to someone else or another service. Never a dead end. */
function DraftNotFound({ service, session }: { service: ServiceDefinition; session: Session }) {
  const verified = meetsTier(session.tier, 'A2');
  return (
    <Frame title={service.title}>
      <UnavailableState
        title="We could not find that draft"
        reason="It may have been submitted, deleted or expired, or it was saved by a different account or for a different service."
        whatNext={
          verified
            ? 'Check your applications to see whether it was already submitted, or start a new one.'
            : 'Start a new application. Drafts you save are listed on your home screen.'
        }
        actions={
          <>
            <LinkButton href={`/apply/?service=${encodeURIComponent(service.code)}`}>
              Start a new application
            </LinkButton>
            <LinkButton href={verified ? '/applications/' : '/home/'} variant="secondary">
              {verified ? 'My applications' : 'Back to home'}
            </LinkButton>
            <LinkButton href="/help/" variant="quiet">
              Get help
            </LinkButton>
          </>
        }
      />
    </Frame>
  );
}

/**
 * Loads a saved draft, then hands it to the flow as its starting point. The
 * draft is read once: after that the flow owns the answers, so the query stops
 * (submitting deletes the draft, which must not replace the confirmation with
 * "not found").
 */
function ResumeDraft({
  service,
  session,
  draftId,
}: {
  service: ServiceDefinition;
  session: Session;
  draftId: string;
}) {
  const [opened, setOpened] = useState<ApplicationDraft | null>(null);
  const query = useGatewayQuery(['draft', draftId], (g) => g.workflow.getDraft(draftId), {
    enabled: opened === null,
  });
  const own = (draft: ApplicationDraft) => isOwnDraft(draft, service.code, session.subjectRef);

  if (opened === null && query.data && own(query.data)) setOpened(query.data);

  if (opened) {
    return (
      <ApplyFlow key={opened.draftId} service={service} session={session} initialDraft={opened} />
    );
  }
  if (query.isError && query.error.category === 'NOT_FOUND') {
    return <DraftNotFound service={service} session={session} />;
  }
  if (query.data && !own(query.data)) {
    return <DraftNotFound service={service} session={session} />;
  }
  return (
    <Frame title={service.title}>
      <QueryBoundary query={query} loadingLabel="Loading your saved application" loadingRows={3}>
        {() => <LoadingState label="Opening your saved application" rows={3} />}
      </QueryBoundary>
    </Frame>
  );
}

export function ApplyScreen() {
  const params = useSearchParams();
  const { session } = useSession();
  const code = params.get('service');
  const draftParam = params.get('draft');
  // A draft this screen created itself. Its id is added to the address so a refresh resumes
  // it, but the flow that created it is already running and must not be reloaded.
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);

  if (!session) return null; // The page guard has already asked for sign-in.

  const service = code ? findService(code) : undefined;
  if (!service || service.availability !== 'APPLY_ONLINE' || !service.form) {
    return <CannotStart code={code} service={service} />;
  }

  const resumeId = draftParam && draftParam !== createdDraftId ? draftParam : null;
  return resumeId ? (
    <ResumeDraft
      key={`${service.code}:${resumeId}`}
      service={service}
      session={session}
      draftId={resumeId}
    />
  ) : (
    <ApplyFlow
      key={`${service.code}:new`}
      service={service}
      session={session}
      initialDraft={null}
      onDraftCreated={setCreatedDraftId}
    />
  );
}
