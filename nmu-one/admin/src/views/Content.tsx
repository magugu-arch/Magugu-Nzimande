'use client';

import { useState } from 'react';
import {
  answerQuestion,
  detectIntent,
  type AssistantAnswer,
  type IntentId,
} from '@core/assistant/assistant';
import { ROLES, type LifecycleStage, type Role } from '@core/domain/models';
import { southCampus } from '@core/fixtures/campus';
import { supportRoutes } from '@core/fixtures/support';
import { CAPABILITY_LABELS, decide, type Capability } from '@core/permissions/policy';
import { Badge, Card, Dialog, PageHeader, ReadOnlyNote } from '@/components/ui';
import { ROLE_LABELS } from '@/lib/audience';
import { when } from '@/lib/format';
import { allows } from '@/lib/operators';
import { approveArticle, currentOperator, updateArticle, useConsole } from '@/lib/store';
import type { ArticleRecord } from '@/lib/types';
import { clock } from '@core/time/clock';

const LIFECYCLE: Record<Role, LifecycleStage> = {
  student: 'student',
  staff: 'staff',
  parent: 'guardian',
  alumni: 'alumni',
};

/** Intents answered from a person's own records — the console never shows those. */
const PERSONAL: Partial<Record<IntentId, { service: string; capability: Capability }>> = {
  'next-class': { service: 'their timetable', capability: 'academics.timetable' },
  balance: { service: 'their fee account', capability: 'finance.view' },
  funding: { service: 'their funding record', capability: 'funding.view' },
  'study-space': { service: 'live study-space availability', capability: 'library.book' },
  shuttle: { service: 'the live shuttle feed', capability: 'transport.view' },
  exams: { service: 'their assessments', capability: 'academics.exams' },
};

const INTENT_LABEL: Record<IntentId, string> = {
  safety: 'Safety',
  crisis: 'Crisis support',
  locate: 'Find a place',
  'next-class': 'Next class',
  balance: 'Fee balance',
  funding: 'Funding',
  'study-space': 'Study spaces',
  shuttle: 'Shuttle',
  exams: 'Assessments',
  knowledge: 'Help article',
  handoff: 'Hand-off to a person',
};

type TestResult =
  | {
      kind: 'personal';
      intent: IntentId;
      service: string;
      capability: Capability;
      allowed: boolean;
    }
  | { kind: 'answer'; answer: AssistantAnswer; pendingMatch: ArticleRecord | null };

export function Content() {
  const data = useConsole();
  const op = currentOperator(data);
  const canEdit = allows(op, 'manage-content');
  const canApprove = allows(op, 'approve');
  const [editing, setEditing] = useState<ArticleRecord | null>(null);
  const [draft, setDraft] = useState({ title: '', body: '', keywords: '' });
  const [question, setQuestion] = useState('Who handles residence requests?');
  const [role, setRole] = useState<Role>('student');
  const [result, setResult] = useState<TestResult | null>(null);

  const approved = data.articles.filter((a) => a.status === 'approved');

  const ask = async () => {
    const q = question.trim();
    if (!q) return;
    const intent = detectIntent(q);
    const personal = PERSONAL[intent];
    if (personal) {
      const allowed = decide({ role, lifecycle: LIFECYCLE[role] }, personal.capability).allowed;
      setResult({
        kind: 'personal',
        intent,
        service: personal.service,
        capability: personal.capability,
        allowed,
      });
      return;
    }
    const none = () => Promise.reject(new Error('not available in the console'));
    const answer = await answerQuestion(q, {
      role,
      givenName: 'there',
      now: clock.now(),
      decide: (c) => decide({ role, lifecycle: LIFECYCLE[role] }, c),
      data: {
        map: async () => southCampus,
        knowledge: async () => approved,
        supportRoutes: async () => supportRoutes,
        account: none,
        funding: none,
        studySpaces: none,
        arrivals: none,
        routes: none,
        timetable: none,
        exams: none,
      },
    });
    // Would an article still in review have answered it? Tell the operator.
    let pendingMatch: ArticleRecord | null = null;
    if (answer.kind === 'handoff') {
      const all = await answerQuestion(q, {
        role,
        givenName: 'there',
        now: clock.now(),
        decide: (c) => decide({ role, lifecycle: LIFECYCLE[role] }, c),
        data: {
          map: async () => southCampus,
          knowledge: async () => data.articles,
          supportRoutes: async () => supportRoutes,
          account: none,
          funding: none,
          studySpaces: none,
          arrivals: none,
          routes: none,
          timetable: none,
          exams: none,
        },
      });
      if (all.kind === 'answer')
        pendingMatch = data.articles.find((a) => a.body === all.text) ?? null;
    }
    setResult({ kind: 'answer', answer, pendingMatch });
  };

  return (
    <>
      <PageHeader
        eyebrow="Trust"
        title="Help content & search"
        description="The assistant never makes things up: it answers from connected services or from these articles, and only once each article’s owner has approved it."
      />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card
          title="Help articles"
          description={`${approved.length} of ${data.articles.length} approved for the assistant.`}
        >
          {!canEdit && !canApprove ? (
            <ReadOnlyNote>Your role can read articles but not change or approve them.</ReadOnlyNote>
          ) : null}
          <ul className="list">
            {data.articles.map((a) => (
              <li key={a.id} className="stack-sm">
                <div className="spread">
                  <span className="cell-title">{a.title}</span>
                  <Badge tone={a.status === 'approved' ? 'success' : 'warning'}>
                    {a.status === 'approved' ? 'Approved' : 'Awaiting owner'}
                  </Badge>
                </div>
                <p className="small">{a.body}</p>
                <p className="small muted">
                  Owner: {a.owner} · updated {when(a.updatedAt)} · for{' '}
                  {a.roles.map((r) => ROLE_LABELS[r].toLowerCase()).join(', ')}
                </p>
                <div className="row">
                  {canEdit ? (
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        setEditing(a);
                        setDraft({ title: a.title, body: a.body, keywords: a.keywords.join(', ') });
                      }}
                    >
                      Edit<span className="visually-hidden"> “{a.title}”</span>
                    </button>
                  ) : null}
                  {canApprove && a.status !== 'approved' ? (
                    <button
                      type="button"
                      className="btn small primary"
                      onClick={() => approveArticle(a.id)}
                    >
                      Approve<span className="visually-hidden"> “{a.title}”</span>
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Try the assistant"
          description="Ask what a student, parent, staff member or graduate would ask. Answers use approved articles only."
        >
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <div className="field">
              <label htmlFor="q">Question</label>
              <input
                id="q"
                type="search"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ask-role">Asked by</label>
              <select id="ask-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r].replace(/s$/, '')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <button type="submit" className="btn primary">
                Ask
              </button>
            </div>
          </form>
          <div aria-live="polite" style={{ marginTop: 16 }}>
            {result?.kind === 'personal' ? (
              <div className="notice tone-info">
                <strong>Routed to: {INTENT_LABEL[result.intent]}</strong>
                <span>
                  {result.allowed
                    ? `NMU ONE answers this from ${result.service} for the person asking. Personal records aren’t shown in the console.`
                    : `A ${role} doesn’t have “${CAPABILITY_LABELS[result.capability]}”, so the assistant explains that and points to where they can get help.`}
                </span>
              </div>
            ) : null}
            {result?.kind === 'answer' ? (
              <div className="stack-sm">
                <div
                  className={`notice tone-${result.answer.kind === 'handoff' ? 'warning' : 'success'}`}
                >
                  <strong>
                    {result.answer.kind === 'handoff'
                      ? 'No approved answer — hands off to a person'
                      : `Answered · ${INTENT_LABEL[result.answer.intent]}`}
                  </strong>
                  <span>{result.answer.text}</span>
                  {result.answer.source ? (
                    <span className="small">Source: {result.answer.source.label}</span>
                  ) : null}
                  {result.answer.action ? (
                    <span className="small">
                      Next step: “{result.answer.action.label}” →{' '}
                      <span className="code">{result.answer.action.href}</span>
                    </span>
                  ) : null}
                </div>
                {result.pendingMatch ? (
                  <p className="small">
                    “{result.pendingMatch.title}” would answer this once its owner approves it.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Dialog
        open={editing !== null}
        title={editing ? `Edit “${editing.title}”` : 'Edit article'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={async () => {
                if (!editing) return;
                const r = await updateArticle(editing.id, {
                  title: draft.title,
                  body: draft.body,
                  keywords: draft.keywords
                    .split(',')
                    .map((k) => k.trim().toLowerCase())
                    .filter(Boolean),
                });
                if (r.ok) setEditing(null);
              }}
            >
              Save and send for approval
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="art-title">Title</label>
          <input
            id="art-title"
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="art-body">Answer</label>
          <span className="hint" id="art-body-hint">
            Describe what NMU ONE does. Don’t state university policy unless its owner has written
            it.
          </span>
          <textarea
            id="art-body"
            aria-describedby="art-body-hint"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="art-keywords">Keywords (comma-separated)</label>
          <input
            id="art-keywords"
            type="text"
            value={draft.keywords}
            onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
          />
        </div>
        <p className="hint">
          Saving sends the article back to its owner; the assistant stops using it until it’s
          approved again.
        </p>
      </Dialog>
    </>
  );
}
