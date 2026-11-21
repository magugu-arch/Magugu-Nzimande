'use client';

import { announce } from '@hao/accessibility';
import type {
  AccessFeature,
  ServicePoint,
  ServicePointFilter,
  ServicePointKind,
} from '@hao/api-contracts';
import {
  AppLink,
  Button,
  Card,
  Checkbox,
  Container,
  EmptyState,
  Grid,
  LinkButton,
  PageHeader,
  SampleNotice,
  Section,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  TextInput,
  cx,
  stretchedLinkClass,
} from '@hao/design-system';
import type { GatewayError } from '@hao/shared-types';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ArrowRight, FilterX, Globe, List, Map as MapIcon, SearchX } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { SAMPLE_CATALOGUE } from '@/lib/catalogue';
import { getGateway } from '@/lib/gateway';
import { asGatewayError } from '@/lib/queries';
import { PointCard } from './PointCard';
import { SchematicMap } from './SchematicMap';
import styles from './service-points.module.css';
import { ACCESS_FEATURES, ACCESS_LABEL, KIND_LABEL, availabilityLabel } from './words';

const DOMESTIC_KINDS: readonly ServicePointKind[] = [
  'SERVICE_OFFICE',
  'PARTNER_BANK',
  'MOBILE_UNIT',
  'KIOSK',
];
const KIND_OPTIONS = DOMESTIC_KINDS.map((kind) => ({ value: kind, label: KIND_LABEL[kind] }));

/** Sample services with an in-person route inside South Africa. */
const SERVICE_OPTIONS = SAMPLE_CATALOGUE.services
  .filter((service) =>
    service.channels.some(
      (channel) =>
        channel === 'SERVICE_OFFICE' || channel === 'PARTNER_BANK' || channel === 'MOBILE_UNIT',
    ),
  )
  .map((service) => ({ value: service.code, label: service.title }));

const VIEW_OPTIONS = [
  { value: 'list', label: 'List', icon: <List aria-hidden="true" /> },
  { value: 'map', label: 'Map', icon: <MapIcon aria-hidden="true" /> },
];

function isDomesticKind(value: string): value is ServicePointKind {
  return DOMESTIC_KINDS.some((kind) => kind === value);
}

/**
 * Service points for a filter. The last results stay on screen while the next
 * ones load, so typing in the search box does not flash a loading state.
 * (`useGatewayQuery` has no "keep previous data" option, hence the local query.)
 */
function usePoints(filter: ServicePointFilter): UseQueryResult<ServicePoint[], GatewayError> {
  return useQuery<ServicePoint[], GatewayError>({
    queryKey: ['points', filter],
    queryFn: async () => {
      try {
        return await getGateway().appointments.listServicePoints(filter);
      } catch (error) {
        throw asGatewayError(error);
      }
    },
    placeholderData: keepPreviousData,
  });
}

export function ServicePointsScreen() {
  const serviceParam = useSearchParams().get('service');

  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [service, setService] = useState(() =>
    SERVICE_OPTIONS.some((option) => option.value === serviceParam) ? (serviceParam ?? '') : '',
  );
  const [features, setFeatures] = useState<AccessFeature[]>([]);
  const [openOnly, setOpenOnly] = useState(false);
  const [view, setView] = useState('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const text = query.trim();
  const filter: ServicePointFilter = {
    kind: isDomesticKind(kind) ? kind : undefined,
    serviceCode: service || undefined,
    accessibility: features,
    openNow: openOnly || undefined,
    query: text || undefined,
    abroad: false,
  };
  const points = usePoints(filter);

  const hasFilters = Boolean(text || kind || service || features.length > 0 || openOnly);
  const count = points.data?.length;
  const countText =
    count === undefined
      ? ''
      : `${count} sample service ${count === 1 ? 'point' : 'points'} ${count === 1 ? 'matches' : 'match'}`;

  const clearFilters = () => {
    setQuery('');
    setKind('');
    setService('');
    setFeatures([]);
    setOpenOnly(false);
    announce('Filters cleared.');
  };

  const toggleFeature = (feature: AccessFeature, on: boolean) => {
    setFeatures((current) =>
      // Keep the filter order stable, so the same choice always gives the same query.
      ACCESS_FEATURES.filter((item) => (item === feature ? on : current.includes(item))),
    );
  };

  const select = (point: ServicePoint) => {
    setSelectedId(point.id);
    announce(`${point.name} selected. Its details are shown below the map.`);
  };

  return (
    <Container>
      <div className={styles.head}>
        <PageHeader
          title="Find a service point"
          lede="Service offices, partner bank points, mobile units and self-service kiosks — with what each one can do and how accessible it is."
        />
        {/* A generic building, used as decoration only. It is not any real office. */}
        <Photo
          asset="A38"
          ratio="16 / 9"
          shape="soft"
          className={styles.headPhoto}
          sizes="(min-width: 60rem) 28rem, 100vw"
          priority
          decorative
        />
      </div>

      <Stack gap={7}>
        <Stack gap={5}>
          <SampleNotice>
            These locations are synthetic. Real service points, hours and live availability will
            come from Home Affairs and its partners.
          </SampleNotice>

          <div className={styles.finder}>
            <form
              className={styles.filters}
              role="search"
              aria-labelledby="filters-heading"
              onSubmit={(event) => event.preventDefault()}
            >
              <h2 id="filters-heading" className={styles.filtersTitle}>
                Filter
              </h2>
              <TextInput
                label="Search by name or area"
                hint="The places are invented. Try “Demo Central” or “Sample Bay”."
                type="search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Select
                label="Type"
                placeholder="All types"
                options={KIND_OPTIONS}
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              />
              <Select
                label="Service"
                placeholder="All services"
                options={SERVICE_OPTIONS}
                value={service}
                onChange={(event) => setService(event.target.value)}
              />
              <fieldset className={styles.fieldset}>
                <legend>Accessibility</legend>
                <div className={styles.checks}>
                  {ACCESS_FEATURES.map((feature) => (
                    <Checkbox
                      key={feature}
                      label={ACCESS_LABEL[feature]}
                      checked={features.includes(feature)}
                      onChange={(event) => toggleFeature(feature, event.target.checked)}
                    />
                  ))}
                </div>
              </fieldset>
              <Switch
                label="Only show points open today"
                hint="Uses the status each point reports (sample)."
                checked={openOnly}
                onChange={setOpenOnly}
              />
              <div>
                <Button
                  variant="secondary"
                  iconStart={<FilterX aria-hidden="true" />}
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              </div>
            </form>

            <section className={styles.results} aria-labelledby="results-heading">
              <div className={styles.resultsHead}>
                <div>
                  <h2 id="results-heading" className={styles.resultsTitle}>
                    Service points
                  </h2>
                  <p className={styles.count} role="status">
                    {countText}
                  </p>
                </div>
                <SegmentedControl
                  label="View"
                  name="points-view"
                  value={view}
                  onChange={setView}
                  options={VIEW_OPTIONS}
                />
              </div>

              <QueryBoundary
                query={points}
                loadingLabel="Loading service points"
                headingLevel={3}
                isEmpty={(items) => items.length === 0}
                empty={
                  <EmptyState
                    title="No sample service points match"
                    headingLevel={3}
                    icon={<SearchX />}
                    actions={
                      <>
                        {hasFilters ? <Button onClick={clearFilters}>Clear filters</Button> : null}
                        <LinkButton href="/help/" variant="secondary">
                          Get help
                        </LinkButton>
                      </>
                    }
                  >
                    <p>
                      Try fewer filters or a different area. If you are not sure where to go, an
                      adviser can help you choose.
                    </p>
                  </EmptyState>
                }
              >
                {(items) => {
                  const selected = items.find((point) => point.id === selectedId) ?? null;
                  if (view === 'list') {
                    return (
                      <ul
                        className={styles.cards}
                        aria-busy={points.isPlaceholderData || undefined}
                      >
                        {items.map((point) => (
                          <li key={point.id}>
                            <PointCard point={point} />
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <div
                      className={styles.mapLayout}
                      aria-busy={points.isPlaceholderData || undefined}
                    >
                      <div className={styles.mapColumn}>
                        <SchematicMap
                          points={items}
                          selectedId={selected?.id ?? null}
                          onSelect={select}
                        />
                        {selected ? (
                          <PointCard
                            point={selected}
                            number={items.indexOf(selected) + 1}
                            headingLevel={3}
                          />
                        ) : (
                          <p className={styles.mapHint}>
                            Choose a numbered pin, or a name in the list, to see its details here.
                          </p>
                        )}
                      </div>
                      <ol className={styles.mapList} aria-label="Service points on the map">
                        {items.map((point, index) => {
                          const current = point.id === selected?.id;
                          return (
                            <li key={point.id}>
                              <button
                                type="button"
                                className={cx(styles.mapItem, current && styles.mapItemSelected)}
                                aria-pressed={current}
                                onClick={() => select(point)}
                              >
                                <span className={styles.mapItemNumber} aria-hidden="true">
                                  {index + 1}
                                </span>
                                <span className={styles.mapItemText}>
                                  <span className={styles.mapItemName}>{point.name}</span>
                                  <span className={styles.mapItemMeta}>
                                    {KIND_LABEL[point.kind]} ·{' '}
                                    {availabilityLabel(point.availability)}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  );
                }}
              </QueryBoundary>
            </section>
          </div>
        </Stack>

        <Card tone="sunken" interactive className={styles.abroad}>
          <span className={styles.abroadIcon} aria-hidden="true">
            <Globe />
          </span>
          <div className={styles.abroadText}>
            <h2 className={styles.abroadTitle}>
              <AppLink href="/abroad/" className={stretchedLinkClass}>
                Living abroad? See missions and time zones
              </AppLink>
            </h2>
            <p>A preview of how the service could work for South Africans overseas.</p>
          </div>
          <ArrowRight aria-hidden="true" className={styles.abroadArrow} />
        </Card>

        <Section
          title="Access for everyone"
          id="access"
          intro="Every journey has an in-person route. These are the kinds of support a service point can list."
        >
          <Grid gap={4} min="15rem">
            <article className={styles.access}>
              <Photo asset="A03" ratio="4 / 3" sizes="(min-width: 60rem) 22rem, 100vw" decorative />
              <h3>A counter you can reach</h3>
              <p>Step-free access and lowered counters, so nobody has to be served at the door.</p>
            </article>
            <article className={styles.access}>
              <Photo asset="A37" ratio="4 / 3" sizes="(min-width: 60rem) 22rem, 100vw" decorative />
              <h3>Assisted service</h3>
              <p>A person to help with any step, while you keep hold of your own phone.</p>
            </article>
            <article className={styles.access}>
              <Photo asset="A46" ratio="4 / 3" sizes="(min-width: 60rem) 22rem, 100vw" decorative />
              <h3>Communication support</h3>
              <p>For example sign-language interpretation by booking, where a point offers it.</p>
            </article>
          </Grid>
          <p className={styles.accessNote}>
            These photographs illustrate the access features. They do not show, or make a claim
            about, any specific office.{' '}
            <AppLink href="/profile/accessibility/">Accessibility settings</AppLink>
          </p>
        </Section>
      </Stack>
    </Container>
  );
}
