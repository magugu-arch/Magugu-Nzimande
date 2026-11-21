'use client';

import { announce } from '@hao/accessibility';
import type {
  ApplicationCase,
  SearchResult,
  ServicePoint,
  ServicePointKind,
} from '@hao/api-contracts';
import {
  AppLink,
  Button,
  Container,
  EmptyState,
  Grid,
  LinkButton,
  PageHeader,
  Section,
  Tag,
  TextInput,
} from '@hao/design-system';
import { maskReference, meetsTier } from '@hao/shared-types';
import {
  Baby,
  BookOpen,
  BookUser,
  ClipboardList,
  FileText,
  IdCard,
  LibraryBig,
  LifeBuoy,
  MapPin,
  MapPinned,
  MessageCircleQuestion,
  Plane,
  Search,
  SearchX,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { IconTile, Row, Rows } from '@/components/cards';
import { QueryBoundary } from '@/components/QueryBoundary';
import { StatusTag } from '@/components/StatusTag';
import { serviceHref } from '@/lib/catalogue';
import { formatRelative } from '@/lib/format';
import { useFlags } from '@/lib/prefs';
import { useGatewayQuery } from '@/lib/queries';
import { useSession } from '@/lib/session';
import styles from './search.module.css';

interface SearchData {
  services: SearchResult[];
  guidance: SearchResult[];
  points: ServicePoint[];
  cases: ApplicationCase[];
}

const POINT_KIND: Record<ServicePointKind, string> = {
  SERVICE_OFFICE: 'Service office',
  PARTNER_BANK: 'Partner bank point',
  MOBILE_UNIT: 'Mobile unit',
  KIOSK: 'Self-service kiosk',
  MISSION_ABROAD: 'Mission abroad',
};

function totalOf(data: SearchData): number {
  return data.services.length + data.guidance.length + data.points.length + data.cases.length;
}

/** A person's own applications match when every word typed is in the service title or the reference. */
function caseMatches(item: ApplicationCase, query: string): boolean {
  const haystack = `${item.serviceTitle} ${item.caseId}`.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.length > 0 && terms.every((term) => haystack.includes(term));
}

function Group({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <Section
      id={id}
      title={
        <>
          {title} <span className={styles.count}>({count})</span>
        </>
      }
    >
      {children}
    </Section>
  );
}

function SearchForm({ query, onSearch }: { query: string; onSearch: (value: string) => void }) {
  const [value, setValue] = useState(query);
  // When the query in the address changes (a new search, or back and forward), the field follows
  // it. Adjusting state while rendering keeps the field mounted, so focus stays where it was.
  const [shown, setShown] = useState(query);
  if (shown !== query) {
    setShown(query);
    setValue(query);
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(value.trim());
  };
  return (
    <form role="search" onSubmit={submit} className={styles.form} noValidate>
      <TextInput
        label="Search services, guidance and your applications"
        hint="Search by topic, place or service. Do not type ID numbers or other personal details."
        type="search"
        name="q"
        autoComplete="off"
        enterKeyHint="search"
        maxLength={120}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <Button type="submit" iconStart={<Search aria-hidden="true" />}>
        Search
      </Button>
    </form>
  );
}

function StartingPoints({ showGuide }: { showGuide: boolean }) {
  return (
    <Section
      title="Start here"
      id="start"
      intro="Popular places to begin while you decide what to search for."
    >
      <Grid gap={3} min="10.5rem">
        <IconTile
          href={serviceHref('SMART_ID_REPLACEMENT')}
          icon={<IdCard />}
          title="Replace a Smart ID"
          hint="Start online, finish in person"
        />
        <IconTile
          href={serviceHref('ADULT_PASSPORT')}
          icon={<BookUser />}
          title="Apply for a passport"
          hint="Apply, book and track"
        />
        <IconTile
          href={serviceHref('BIRTH_REGISTRATION')}
          icon={<Baby />}
          title="Register a birth"
          hint="For parents and guardians"
        />
        <IconTile
          href={serviceHref('ETA')}
          icon={<Plane />}
          title="Travel to South Africa"
          hint="ETA guidance"
        />
        <IconTile
          href="/service-points/"
          icon={<MapPinned />}
          title="Find a service point"
          hint="Offices, banks and mobile units"
        />
        <IconTile
          href="/help/guidance/"
          icon={<LibraryBig />}
          title="Read the guidance"
          hint="How the service works"
        />
        {showGuide ? (
          <IconTile
            href="/guide/"
            icon={<MessageCircleQuestion />}
            title="Ask the service guide"
            hint="Searches sample guidance"
          />
        ) : null}
        <IconTile
          href="/help/"
          icon={<LifeBuoy />}
          title="Get help"
          hint="Message, call-back or complaint"
        />
      </Grid>
      <p>
        <AppLink href="/services/">Browse all services</AppLink>
      </p>
    </Section>
  );
}

function Results({ data }: { data: SearchData }) {
  return (
    <div className={styles.groups}>
      {data.services.length > 0 ? (
        <Group id="services" title="Services" count={data.services.length}>
          <Rows label="Services">
            {data.services.map((result) => (
              <Row
                key={result.id}
                href={result.href}
                title={result.title}
                lead={<FileText />}
                text={result.snippet}
              />
            ))}
          </Rows>
        </Group>
      ) : null}

      {data.guidance.length > 0 ? (
        <Group id="guidance" title="Guidance" count={data.guidance.length}>
          <Rows label="Guidance">
            {data.guidance.map((result) => (
              <Row
                key={result.id}
                href={result.href}
                title={result.title}
                lead={<BookOpen />}
                text={result.snippet}
                meta={result.citation ? <span>Source: {result.citation}</span> : undefined}
              />
            ))}
          </Rows>
        </Group>
      ) : null}

      {data.points.length > 0 ? (
        <Group id="points" title="Service points" count={data.points.length}>
          <Rows label="Service points">
            {data.points.map((point) => (
              <Row
                key={point.id}
                href={`/service-points/point/?id=${encodeURIComponent(point.id)}`}
                title={point.name}
                lead={<MapPin />}
                meta={
                  <>
                    <Tag>{POINT_KIND[point.kind]}</Tag>
                    <span>
                      {point.area}, {point.region}
                    </span>
                  </>
                }
              />
            ))}
          </Rows>
        </Group>
      ) : null}

      {data.cases.length > 0 ? (
        <Group id="applications" title="Your applications" count={data.cases.length}>
          <Rows label="Your applications">
            {data.cases.map((item) => (
              <Row
                key={item.caseId}
                href={`/applications/case/?id=${encodeURIComponent(item.caseId)}`}
                title={item.serviceTitle}
                lead={<ClipboardList />}
                meta={
                  <>
                    <StatusTag status={item.status} detail={item.statusDetail} />
                    <span>Reference {maskReference(item.caseId)}</span>
                    <span>Updated {formatRelative(item.statusUpdatedAt)}</span>
                  </>
                }
              />
            ))}
          </Rows>
        </Group>
      ) : null}
    </div>
  );
}

export function SearchScreen() {
  const router = useRouter();
  const query = (useSearchParams().get('q') ?? '').trim();
  const { session, ready } = useSession();
  const { flags } = useFlags();

  const citizen = session?.role === 'citizen' ? session : null;
  const verified = citizen ? meetsTier(citizen.tier, 'A2') : false;
  const token = citizen && verified ? citizen.subjectRef : null;

  // One read for the whole page, so loading, offline and error are each shown once.
  const results = useGatewayQuery(
    ['search', query, token],
    async (g): Promise<SearchData> => {
      const [catalogue, points, cases] = await Promise.all([
        g.catalogue.search(query),
        g.appointments.listServicePoints({ query }),
        token ? g.workflow.listCases(token) : Promise.resolve([]),
      ]);
      return {
        services: catalogue.filter((result) => result.kind === 'SERVICE'),
        guidance: catalogue.filter((result) => result.kind === 'GUIDANCE'),
        points,
        cases: cases.filter((item) => caseMatches(item, query)),
      };
    },
    { enabled: query.length > 0 },
  );

  // Say how many results there are, once per search, without moving focus out of the field.
  const total = results.data && query ? totalOf(results.data) : null;
  const announced = useRef('');
  useEffect(() => {
    if (total === null) return;
    const key = `${query}:${total}`;
    if (announced.current === key) return;
    announced.current = key;
    announce(
      total === 0
        ? `No results for ${query}.`
        : `${total} ${total === 1 ? 'result' : 'results'} for ${query}.`,
    );
  }, [query, total]);

  const search = (value: string) => {
    router.replace(value ? `/search/?q=${encodeURIComponent(value)}` : '/search/');
  };

  return (
    <Container>
      <PageHeader
        eyebrow="Search"
        title="Find what you need"
        lede="Search services, guidance and service points in one place. When you are signed in to a verified account, your own applications are searched too."
      />

      <div className={styles.page}>
        <SearchForm query={query} onSearch={search} />

        {ready && !citizen ? (
          <p className={styles.note}>
            <AppLink
              href={`/sign-in/?next=${encodeURIComponent(query ? `/search/?q=${encodeURIComponent(query)}` : '/search/')}`}
            >
              Sign in
            </AppLink>{' '}
            to search your applications as well.
          </p>
        ) : null}
        {citizen && !verified ? (
          <p className={styles.note}>
            Your applications are searched once your account is verified.{' '}
            <AppLink href="/profile/security/">How verification works</AppLink>
          </p>
        ) : null}

        {query ? (
          <>
            {total !== null && total > 0 ? (
              <p className={styles.summary}>
                {total} {total === 1 ? 'result' : 'results'} for “{query}”
              </p>
            ) : null}
            <QueryBoundary
              query={results}
              loadingLabel="Searching"
              isEmpty={(data) => totalOf(data) === 0}
              empty={
                <EmptyState
                  title={`No results for “${query}”`}
                  icon={<SearchX />}
                  actions={
                    <>
                      <LinkButton href="/services/">Browse all services</LinkButton>
                      {flags.aiGuide ? (
                        <LinkButton href="/guide/" variant="secondary">
                          Ask the service guide
                        </LinkButton>
                      ) : null}
                      <LinkButton href="/help/" variant="secondary">
                        Get help
                      </LinkButton>
                    </>
                  }
                >
                  <p>
                    Try fewer or simpler words, such as “passport” or “birth”. Search looks at
                    service names, guidance and the names of service points.
                  </p>
                </EmptyState>
              }
            >
              {(data) => <Results data={data} />}
            </QueryBoundary>
          </>
        ) : (
          <StartingPoints showGuide={flags.aiGuide} />
        )}
      </div>
    </Container>
  );
}
