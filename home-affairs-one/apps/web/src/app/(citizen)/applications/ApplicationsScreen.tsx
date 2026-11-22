'use client';

import { announce } from '@hao/accessibility';
import type { ApplicationCase, ApplicationDraft } from '@hao/api-contracts';
import {
  Button,
  Container,
  Dialog,
  EmptyState,
  LinkButton,
  Notice,
  Section,
  Stack,
  Tag,
} from '@hao/design-system';
import { maskReference, STATUS_INFO } from '@hao/shared-types';
import { FilePen, FileText, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Row, Rows } from '@/components/cards';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { StatusTag } from '@/components/StatusTag';
import { findService } from '@/lib/catalogue';
import { formatDate, formatRelative } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useGatewayMutation, useGatewayQuery } from '@/lib/queries';
import { usePersonToken } from '@/lib/session';
import styles from './applications.module.css';
import { caseHref, PhotoHeader, sentence } from './case-helpers';

interface DraftToDelete {
  draftId: string;
  title: string;
  /** One key for this decision to delete; a retry reuses it. */
  key: string;
}

function draftTitle(draft: ApplicationDraft): string {
  return findService(draft.serviceCode)?.title ?? 'Application';
}

function Counted({ label, count }: { label: string; count: number }) {
  return (
    <>
      {label} <span className={styles.count}>{count}</span>
    </>
  );
}

function CaseRows({ items, label }: { items: ApplicationCase[]; label: string }) {
  return (
    <Rows label={label}>
      {items.map((item) => (
        <Row
          key={item.caseId}
          href={caseHref(item.caseId)}
          title={item.serviceTitle}
          lead={<FileText />}
          meta={
            <>
              <StatusTag status={item.status} detail={item.statusDetail} />
              <span>Updated {formatRelative(item.statusUpdatedAt)}</span>
              <span>Reference {maskReference(item.caseId)}</span>
            </>
          }
          text={item.nextAction ? `Next: ${sentence(item.nextAction.description)}` : undefined}
        />
      ))}
    </Rows>
  );
}

function Lists({
  cases,
  drafts,
  onDelete,
}: {
  cases: ApplicationCase[];
  drafts: ApplicationDraft[];
  onDelete: (draft: ApplicationDraft) => void;
}) {
  const attention = cases.filter((item) => item.status === 'ACTION_REQUIRED');
  const inProgress = cases.filter(
    (item) => item.status !== 'ACTION_REQUIRED' && item.status !== 'CLOSED',
  );
  const closed = cases.filter((item) => item.status === 'CLOSED');

  return (
    <Stack gap={6}>
      {attention.length > 0 ? (
        <Section
          id="attention"
          title={<Counted label="Needs your attention" count={attention.length} />}
          intro="These are paused until you complete the step shown."
        >
          <CaseRows items={attention} label="Applications that need your attention" />
        </Section>
      ) : null}

      {inProgress.length > 0 ? (
        <Section id="in-progress" title={<Counted label="In progress" count={inProgress.length} />}>
          <CaseRows items={inProgress} label="Applications in progress" />
        </Section>
      ) : null}

      {drafts.length > 0 ? (
        <Section
          id="drafts"
          title={<Counted label="Drafts — not submitted" count={drafts.length} />}
          intro={STATUS_INFO.DRAFT.rule}
        >
          <ul className={styles.drafts} aria-label="Drafts that are not submitted">
            {drafts.map((draft) => {
              const title = draftTitle(draft);
              return (
                <li key={draft.draftId} className={styles.draft}>
                  <span className={styles.draftIcon} aria-hidden="true">
                    <FilePen />
                  </span>
                  <div className={styles.draftBody}>
                    <h3 className={styles.draftTitle}>{title}</h3>
                    <div className={styles.draftMeta}>
                      <Tag>Not submitted</Tag>
                      <span>Saved {formatRelative(draft.updatedAt)}</span>
                      <span>Expires {formatDate(draft.expiresAt)}</span>
                    </div>
                  </div>
                  <div className={styles.draftActions}>
                    <LinkButton
                      href={`/apply/?service=${encodeURIComponent(draft.serviceCode)}&draft=${encodeURIComponent(draft.draftId)}`}
                      variant="secondary"
                      size="sm"
                    >
                      Continue<span className="visually-hidden"> {title}</span>
                    </LinkButton>
                    <Button
                      variant="quiet"
                      size="sm"
                      iconStart={<Trash2 aria-hidden="true" />}
                      onClick={() => onDelete(draft)}
                    >
                      Delete draft<span className="visually-hidden">: {title}</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {closed.length > 0 ? (
        <Section
          id="closed"
          title={<Counted label="Completed and closed" count={closed.length} />}
          intro="The record of each one stays in your history."
        >
          <CaseRows items={closed} label="Completed and closed applications" />
        </Section>
      ) : null}
    </Stack>
  );
}

export function ApplicationsScreen() {
  const token = usePersonToken() ?? '';
  const cases = useGatewayQuery(['cases', token], (g) => g.workflow.listCases(token), {
    enabled: token !== '',
  });
  const drafts = useGatewayQuery(['drafts', token], (g) => g.workflow.listDrafts(token), {
    enabled: token !== '',
  });

  const [target, setTarget] = useState<DraftToDelete | null>(null);
  const [deleted, setDeleted] = useState<{ title: string } | null>(null);
  const confirmation = useRef<HTMLDivElement>(null);

  const remove = useGatewayMutation((g, input: DraftToDelete) =>
    g.workflow.deleteDraft(input.draftId, { idempotencyKey: input.key }),
  );

  // The button that opened the dialog is gone once the draft is deleted, so focus moves to the confirmation.
  useEffect(() => {
    if (deleted) confirmation.current?.focus();
  }, [deleted]);

  const askToDelete = (draft: ApplicationDraft) => {
    remove.reset();
    setTarget({
      draftId: draft.draftId,
      title: draftTitle(draft),
      key: newIdempotencyKey('delete-draft'),
    });
  };

  const confirmDelete = () => {
    if (!target) return;
    remove.mutate(target, {
      onSuccess: () => {
        setTarget(null);
        setDeleted({ title: target.title });
        announce(`Draft deleted: ${target.title}.`);
      },
    });
  };

  return (
    <Container>
      <PhotoHeader
        title="My applications"
        lede="Everything you have applied for, in one timeline."
        photo={<Photo asset="A30" ratio="4 / 5" sizes="11rem" />}
      />

      <Stack gap={5}>
        {deleted ? (
          <div ref={confirmation} tabIndex={-1} className={styles.confirm}>
            <Notice tone="success" role="status" title="Draft deleted">
              <p>“{deleted.title}” was removed from this device. It was never submitted.</p>
            </Notice>
          </div>
        ) : null}

        <QueryBoundary query={cases} loadingLabel="Loading your applications">
          {(caseItems) => (
            <QueryBoundary
              query={drafts}
              loadingLabel="Loading your drafts"
              isEmpty={(draftItems) => caseItems.length === 0 && draftItems.length === 0}
              empty={
                <EmptyState
                  title="No applications yet"
                  icon={<FileText />}
                  actions={<LinkButton href="/services/">Find a service</LinkButton>}
                >
                  <p>When you apply for something, you can follow every step here.</p>
                </EmptyState>
              }
            >
              {(draftItems) => (
                <Lists cases={caseItems} drafts={draftItems} onDelete={askToDelete} />
              )}
            </QueryBoundary>
          )}
        </QueryBoundary>
      </Stack>

      <Dialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Delete this draft?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Keep draft
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={confirmDelete}>
              Delete draft
            </Button>
          </>
        }
      >
        <p>
          Your saved answers for “{target?.title}” will be removed from this device. This cannot be
          undone.
        </p>
        <p>The draft has not been submitted, so there is nothing to withdraw.</p>
        {remove.error ? (
          <Notice tone="danger" role="alert" title="We could not delete the draft">
            <p>{remove.error.safeMessage}</p>
            <p>Reference for support: {remove.error.traceRef}</p>
          </Notice>
        ) : null}
      </Dialog>
    </Container>
  );
}
