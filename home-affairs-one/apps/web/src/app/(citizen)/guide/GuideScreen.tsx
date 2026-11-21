'use client';

import { announce } from '@hao/accessibility';
import type { GuidanceArticle, SearchResult } from '@hao/api-contracts';
import {
  AppLink,
  Button,
  Card,
  Container,
  FutureNotice,
  LinkButton,
  Notice,
  PageHeader,
  TextInput,
  UnavailableState,
} from '@hao/design-system';
import { ArrowRight, Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { useFlags } from '@/lib/prefs';
import { useGatewayQuery } from '@/lib/queries';
import { classifyQuestion } from './classify-question';
import styles from './guide.module.css';

type Turn =
  | { id: number; kind: 'question'; question: string; asksForDecision: boolean }
  /** The text is deliberately not kept: it looked like it held personal details. */
  | { id: number; kind: 'personal-data' };

const SUGGESTIONS = [
  'I lost my ID',
  'I need a passport',
  'Register a birth',
  'What does my status mean?',
  'How will you contact me?',
  'Applying from abroad',
];

const DECISION_TEXT =
  'I can’t assess eligibility, outcomes or timeframes. Decisions are made by authorised officials under the law, and timeframes are only shown when they come from live operational data.';
const PERSONAL_DATA_TEXT =
  'Please don’t type ID numbers, document numbers or contact details here. Ask in general terms.';

/** How many matches make up one answer. */
const ANSWER_SIZE = 3;

function TalkToAPerson() {
  return (
    <p className={styles.person}>
      Not what you needed? <AppLink href="/help/">Talk to a person</AppLink>
    </p>
  );
}

function Match({
  result,
  articles,
}: {
  result: SearchResult;
  articles: GuidanceArticle[] | undefined;
}) {
  if (result.kind === 'GUIDANCE') {
    // Quote the opening paragraph of the article itself, so the words are the approved ones.
    const article = articles?.find((item) => item.id === result.id);
    return (
      <li className={styles.match}>
        <p className={styles.kind}>Guidance</p>
        <h3>{result.title}</h3>
        <blockquote className={styles.quote}>
          <p>{article?.body[0] ?? result.snippet}</p>
        </blockquote>
        {result.citation ? <p className={styles.citation}>Source: {result.citation}</p> : null}
        <AppLink href={result.href} className={styles.more}>
          Read the full guidance
          <span className="visually-hidden">: {result.title}</span>
          <ArrowRight aria-hidden="true" />
        </AppLink>
      </li>
    );
  }
  return (
    <li className={styles.match}>
      <p className={styles.kind}>Service</p>
      <h3>{result.title}</h3>
      <p>{result.snippet}</p>
      <AppLink href={result.href} className={styles.more}>
        See this service
        <span className="visually-hidden">: {result.title}</span>
        <ArrowRight aria-hidden="true" />
      </AppLink>
    </li>
  );
}

function Answer({
  turn,
  articles,
}: {
  turn: Extract<Turn, { kind: 'question' }>;
  articles: GuidanceArticle[] | undefined;
}) {
  const results = useGatewayQuery(['guide', turn.question], (g) =>
    g.catalogue.search(turn.question),
  );

  return (
    <Card className={styles.answer}>
      <p className={styles.who}>Service guide · search of sample guidance</p>

      {turn.asksForDecision ? (
        <Notice tone="attention">
          <p>{DECISION_TEXT}</p>
        </Notice>
      ) : null}

      <QueryBoundary
        query={results}
        loadingLabel="Searching the sample guidance"
        loadingRows={2}
        headingLevel={3}
        isEmpty={(found) => found.length === 0}
        empty={
          <div className={styles.nothing}>
            <p>
              <strong>Nothing in the sample guidance matches that question.</strong> The guide only
              matches the words you type, so shorter or simpler wording may help.
            </p>
            <ul>
              <li>
                <AppLink href={`/search/?q=${encodeURIComponent(turn.question)}`}>
                  Search services, guidance and service points
                </AppLink>
              </li>
              <li>
                <AppLink href="/services/">Browse all services</AppLink>
              </li>
              <li>
                <AppLink href="/help/">Get help from a person</AppLink>
              </li>
            </ul>
          </div>
        }
      >
        {(found) => (
          <>
            <p className={styles.lead}>
              {turn.asksForDecision
                ? 'This is the general guidance that matches your words:'
                : 'These are the closest matches to your words:'}
            </p>
            <ul className={styles.matches}>
              {found.slice(0, ANSWER_SIZE).map((result) => (
                <Match key={`${result.kind}:${result.id}`} result={result} articles={articles} />
              ))}
            </ul>
          </>
        )}
      </QueryBoundary>

      <TalkToAPerson />
    </Card>
  );
}

export function GuideScreen() {
  const { flags } = useFlags();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);
  const field = useRef<HTMLDivElement>(null);
  const latest = useRef<HTMLLIElement>(null);

  // Fetched once; every answer looks its articles up by id.
  const guidance = useGatewayQuery(['guidance'], (g) => g.catalogue.listGuidance(), {
    enabled: flags.aiGuide,
  });

  // Bring each new question to the top of the view, so its answer can be read from the start.
  const turnCount = turns.length;
  useEffect(() => {
    if (turnCount > 0) latest.current?.scrollIntoView({ block: 'start' });
  }, [turnCount]);

  if (!flags.aiGuide) {
    return (
      <Container width="narrow">
        <PageHeader eyebrow="Service guide" title="Ask about a service" />
        <UnavailableState
          title="The service guide is switched off"
          reason="The guide is a gated capability. It stays off until it has legal, security and operational approval, and it is switched off in this profile."
          whatNext="Browse the services, search for what you need, or get help from a person."
          alternatives={[
            <AppLink key="guidance" href="/help/guidance/">
              Read the guidance library
            </AppLink>,
            <AppLink key="points" href="/service-points/">
              Find a service point where someone can help you in person
            </AppLink>,
          ]}
          actions={
            <>
              <LinkButton href="/services/">Browse services</LinkButton>
              <LinkButton href="/search/" variant="secondary">
                Search
              </LinkButton>
              <LinkButton href="/help/" variant="secondary">
                Get help
              </LinkButton>
            </>
          }
        />
      </Container>
    );
  }

  const ask = (text: string) => {
    const question = text.replace(/\s+/g, ' ').trim();
    if (!question) {
      setError('Type a question, or choose one of the suggestions.');
      field.current?.querySelector('input')?.focus();
      return;
    }
    const id = nextId.current;
    nextId.current += 1;
    const { containsPersonalData, asksForDecision } = classifyQuestion(question);
    setTurns((current) => [
      ...current,
      containsPersonalData
        ? { id, kind: 'personal-data' }
        : { id, kind: 'question', question, asksForDecision },
    ]);
    // The field is cleared either way, so personal details never stay on screen.
    setDraft('');
    setError(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(draft);
  };

  const clear = () => {
    setTurns([]);
    announce('Conversation cleared.');
    field.current?.querySelector('input')?.focus();
  };

  return (
    <Container>
      <div className={styles.head}>
        <div className={styles.headText}>
          <PageHeader
            eyebrow="Service guide"
            title="Ask about a service"
            lede="Ask a general question and read what the sample guidance says, with the source shown for every answer."
          />
          <FutureNotice>
            In this prototype the guide searches approved sample guidance and shows where each
            answer comes from. It is not connected to an AI model, and it never decides anything
            about an application.
          </FutureNotice>
        </div>
        <Photo asset="A32" ratio="4 / 5" shape="arch" sizes="15rem" className={styles.headPhoto} />
      </div>

      <div className={styles.body}>
        {/* Always in the page, so new answers are announced as they arrive. */}
        <div
          role="log"
          aria-live="polite"
          aria-label="Your questions and the guidance found"
          className={styles.log}
        >
          {turns.length > 0 ? (
            <ol className={styles.turns}>
              {turns.map((turn, index) => (
                <li
                  key={turn.id}
                  className={styles.turn}
                  ref={index === turns.length - 1 ? latest : undefined}
                >
                  {turn.kind === 'question' ? (
                    <>
                      <h2 className={styles.question}>
                        <span className={styles.who}>You asked</span>
                        {turn.question}
                      </h2>
                      <Answer turn={turn} articles={guidance.data} />
                    </>
                  ) : (
                    <>
                      <h2 className={styles.question}>
                        <span className={styles.who}>You asked</span>
                        Question not shown
                      </h2>
                      <Card tone="attention" className={styles.answer}>
                        <p className={styles.who}>Service guide · nothing was searched</p>
                        <p>{PERSONAL_DATA_TEXT}</p>
                        <p className={styles.small}>
                          Your question looked like it contained a number or contact detail, so it
                          was not searched and is not kept on this page.
                        </p>
                        <TalkToAPerson />
                      </Card>
                    </>
                  )}
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        <section className={styles.composer} aria-labelledby="ask-heading">
          <h2 id="ask-heading">{turns.length > 0 ? 'Ask another question' : 'Ask a question'}</h2>

          <div>
            <p className={styles.suggestLabel} id="suggestions-label">
              Try one of these
            </p>
            <ul className={styles.chips} aria-labelledby="suggestions-label">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button type="button" className={styles.chip} onClick={() => ask(suggestion)}>
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={submit} className={styles.form} noValidate>
            <div ref={field}>
              <TextInput
                label="Your question"
                hint="Ask in general terms. Do not type ID numbers, document numbers or contact details."
                autoComplete="off"
                enterKeyHint="send"
                maxLength={200}
                value={draft}
                error={error}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className={styles.formActions}>
              <Button type="submit" iconEnd={<Send aria-hidden="true" />}>
                Ask
              </Button>
              {turns.length > 0 ? (
                <Button variant="quiet" onClick={clear}>
                  Clear conversation
                </Button>
              ) : null}
            </div>
          </form>

          <p className={styles.small}>
            The guide matches the words you type to the sample guidance in this app. Nothing you
            type is saved or leaves this device.
          </p>
        </section>
      </div>
    </Container>
  );
}
