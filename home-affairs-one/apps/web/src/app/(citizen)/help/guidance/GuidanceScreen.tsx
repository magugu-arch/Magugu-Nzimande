'use client';

import { announce, focusMainHeading } from '@hao/accessibility';
import type { GuidanceArticle } from '@hao/api-contracts';
import {
  Button,
  Card,
  Container,
  EmptyState,
  LinkButton,
  PageHeader,
  SampleNotice,
  Section,
  Tag,
  TextInput,
} from '@hao/design-system';
import { BookOpen, FileText, LifeBuoy, SearchX } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Row, Rows } from '@/components/cards';
import { QueryBoundary } from '@/components/QueryBoundary';
import { findService, serviceHref } from '@/lib/catalogue';
import { formatDate } from '@/lib/format';
import { useFlags } from '@/lib/prefs';
import { useGatewayQuery } from '@/lib/queries';
import { AVAILABILITY_TAG } from '../../services/service-labels';
import styles from './guidance.module.css';

/** How many tags a row shows; the filter still looks at all of them. */
const TAGS_SHOWN = 4;

function firstSentence(text: string): string {
  return /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
}

function useGuidance() {
  return useGatewayQuery(['guidance'], (g) => g.catalogue.listGuidance());
}

/* Article ----------------------------------------------------------- */

function Article({ article }: { article: GuidanceArticle }) {
  const services = article.serviceCodes.flatMap((code) => {
    const service = findService(code);
    return service ? [service] : [];
  });

  return (
    <div className={styles.article}>
      <div className={styles.prose}>
        {article.body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      <Card tone="sunken" className={styles.source}>
        <p>
          <strong>
            Source: sample guidance {article.contentVersion}, effective{' '}
            {formatDate(article.effectiveDate)}
          </strong>
        </p>
        <SampleNotice />
        {article.tags.length > 0 ? (
          <p className={styles.topics}>
            <span className="visually-hidden">Topics: </span>
            {article.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </p>
        ) : null}
      </Card>

      {services.length > 0 ? (
        <Section title="Related services" id="related">
          <Rows label="Related services">
            {services.map((service) => {
              const availability = AVAILABILITY_TAG[service.availability];
              return (
                <Row
                  key={service.code}
                  href={serviceHref(service.code)}
                  title={service.title}
                  lead={<FileText />}
                  meta={<Tag tone={availability.tone}>{availability.label}</Tag>}
                />
              );
            })}
          </Rows>
        </Section>
      ) : null}

      <Card className={styles.stuck}>
        <h2>Still stuck?</h2>
        <p>A person can help you by message or call-back, or at a service point.</p>
        <div>
          <LinkButton href="/help/" iconStart={<LifeBuoy aria-hidden="true" />}>
            Get help
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}

function ArticleView({ id }: { id: string }) {
  const guidance = useGuidance();
  const article = guidance.data?.find((item) => item.id === id);

  return (
    <Container width="narrow">
      <PageHeader
        back={{ href: '/help/guidance/', label: 'All guidance' }}
        eyebrow="Guidance"
        title={article?.title ?? 'Guidance'}
      />
      <QueryBoundary
        query={guidance}
        loadingLabel="Loading this guidance"
        isEmpty={(items) => !items.some((item) => item.id === id)}
        empty={
          <EmptyState
            title="We could not find that guidance"
            icon={<SearchX />}
            actions={
              <>
                <LinkButton href="/help/guidance/">See all guidance</LinkButton>
                <LinkButton href="/help/" variant="secondary">
                  Get help
                </LinkButton>
              </>
            }
          >
            <p>It may have been renamed or replaced by a newer version.</p>
          </EmptyState>
        }
      >
        {() => (article ? <Article article={article} /> : null)}
      </QueryBoundary>
    </Container>
  );
}

/* Library ----------------------------------------------------------- */

function LibraryList({ articles }: { articles: GuidanceArticle[] }) {
  const [query, setQuery] = useState('');
  const field = useRef<HTMLDivElement>(null);
  const typed = query.trim();
  const needle = typed.toLowerCase();

  const visible = needle
    ? articles.filter((article) =>
        [article.title, ...article.tags, ...article.body].some((text) =>
          text.toLowerCase().includes(needle),
        ),
      )
    : articles;

  const countText = !needle
    ? `Showing all ${articles.length} guidance articles.`
    : visible.length === 0
      ? `No guidance matches “${typed}”.`
      : `${visible.length} of ${articles.length} guidance articles match “${typed}”.`;

  // Announce the count once typing pauses, so a screen reader is not interrupted on every key.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => announce(countText), 600);
    return () => window.clearTimeout(timer);
  }, [countText]);

  const clear = () => {
    setQuery('');
    field.current?.querySelector('input')?.focus();
  };

  return (
    <div className={styles.library}>
      <div className={styles.filter} ref={field}>
        <TextInput
          label="Filter guidance"
          hint="Type a word, such as “status”, “WhatsApp” or “appointment”."
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className={styles.count}>{countText}</p>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={`No guidance matches “${typed}”`}
          icon={<SearchX />}
          actions={
            <>
              <Button onClick={clear}>Clear filter</Button>
              <LinkButton href={`/search/?q=${encodeURIComponent(typed)}`} variant="secondary">
                Search everything
              </LinkButton>
              <LinkButton href="/help/" variant="secondary">
                Get help
              </LinkButton>
            </>
          }
        >
          <p>Try a shorter or different word, or clear the filter to see every article.</p>
        </EmptyState>
      ) : (
        <Rows label="Guidance articles">
          {visible.map((article) => (
            <Row
              key={article.id}
              href={`/help/guidance/?id=${encodeURIComponent(article.id)}`}
              title={article.title}
              headingLevel={3}
              lead={<BookOpen />}
              text={firstSentence(article.body[0] ?? '')}
              meta={article.tags.slice(0, TAGS_SHOWN).map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            />
          ))}
        </Rows>
      )}
    </div>
  );
}

function LibraryView() {
  const guidance = useGuidance();
  const { flags } = useFlags();

  return (
    <Container width="narrow">
      <PageHeader
        back={{ href: '/help/', label: 'Help' }}
        eyebrow="Help"
        title="Guidance"
        lede="Plain-language answers about how this service works: signing in, statuses, messages, appointments and getting help."
        actions={
          flags.aiGuide ? (
            <LinkButton href="/guide/" variant="secondary">
              Ask the service guide
            </LinkButton>
          ) : undefined
        }
      />
      <h2 className="visually-hidden">All guidance</h2>
      <QueryBoundary
        query={guidance}
        loadingLabel="Loading guidance"
        loadingRows={4}
        isEmpty={(items) => items.length === 0}
        empty={
          <EmptyState
            title="No guidance has been published yet"
            actions={<LinkButton href="/help/">Get help</LinkButton>}
          >
            <p>You can still ask a person for help.</p>
          </EmptyState>
        }
      >
        {(articles) => <LibraryList articles={articles} />}
      </QueryBoundary>
      <div className={styles.foot}>
        <SampleNotice>
          Guidance describes how this prototype behaves. It is not Home Affairs law, policy or
          advice.
        </SampleNotice>
      </div>
    </Container>
  );
}

export function GuidanceScreen() {
  const id = useSearchParams().get('id');

  // The list and an article share one path, so the app shell does not see the change. Move
  // focus to the new heading here, as it does for every other navigation.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    focusMainHeading();
  }, [id]);

  return id ? <ArticleView id={id} /> : <LibraryView />;
}
