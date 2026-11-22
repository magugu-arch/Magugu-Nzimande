'use client';

import { announce } from '@hao/accessibility';
import { AppLink, Button, EmptyState, Grid, LinkButton, Tag, TextInput } from '@hao/design-system';
import { LifeBuoy, SearchX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconTile, PhotoCard } from '@/components/cards';
import { Photo } from '@/components/Photo';
import { AVAILABILITY_TAG, releaseLabel, type Availability, type Release } from './service-labels';
import styles from './services.module.css';

export interface CatalogueService {
  slug: string;
  title: string;
  summary: string;
  availability: Availability;
  release: Release;
  assetId: string;
  /** The photograph is flagged for review and must stay cropped to its subject. */
  tightCrop: boolean;
}

export interface CatalogueGroup {
  anchor: string;
  title: string;
  summary: string;
  assetId: string;
  /** The help group has no services of its own: it links to the help pages. */
  isSupport: boolean;
  services: CatalogueService[];
}

const HELP_TILE = {
  title: 'Get help or make a complaint',
  hint: 'Find answers, ask for a call back or tell us what went wrong.',
};

function matches(needle: string, ...texts: string[]): boolean {
  return texts.some((text) => text.toLowerCase().includes(needle));
}

export function ServiceCatalogue({ groups }: { groups: CatalogueGroup[] }) {
  const [query, setQuery] = useState('');
  const field = useRef<HTMLDivElement>(null);
  const needle = query.trim().toLowerCase();
  const total = groups.reduce((count, group) => count + group.services.length, 0);

  const visible = groups
    .map((group) => {
      const services = needle
        ? group.services.filter((service) => matches(needle, service.title, service.summary))
        : group.services;
      const showHelp =
        group.isSupport &&
        (!needle || matches(needle, group.title, group.summary, HELP_TILE.title, HELP_TILE.hint));
      return { ...group, services, showHelp };
    })
    .filter((group) => group.services.length > 0 || group.showHelp);

  const found = visible.reduce((count, group) => count + group.services.length, 0);
  const typed = query.trim();
  const countText = !needle
    ? `Showing all ${total} services.`
    : found === 0
      ? `No services match “${typed}”.`
      : `${found} of ${total} services match “${typed}”.`;

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
    // The button that was pressed disappears with the empty state, so focus goes back to the field.
    field.current?.querySelector('input')?.focus();
  };

  return (
    <div className={styles.catalogue}>
      <div className={styles.tools}>
        <div className={styles.filter} ref={field}>
          <TextInput
            label="Filter services"
            hint="Type a word, such as “passport” or “birth”."
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className={styles.count}>{countText}</p>
        </div>

        {visible.length > 0 ? (
          <nav aria-label="Jump to a group of services" className={styles.jump}>
            <p className={styles.jumpLabel}>Jump to</p>
            <ul className={styles.jumpList}>
              {visible.map((group) => (
                <li key={group.anchor}>
                  <AppLink href={`#${group.anchor}`}>{group.title}</AppLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={`No services match “${typed}”`}
          icon={<SearchX />}
          actions={
            <>
              <Button onClick={clear}>Clear filter</Button>
              <LinkButton href="/help/" variant="secondary">
                Get help
              </LinkButton>
            </>
          }
        >
          <p>
            Try a shorter or different word, or clear the filter to see every service. If you are
            not sure which service you need, a person can help you find it.
          </p>
        </EmptyState>
      ) : (
        <div className={styles.groups}>
          {visible.map((group) => (
            <section
              key={group.anchor}
              id={group.anchor}
              aria-labelledby={`${group.anchor}-heading`}
              className={styles.group}
            >
              <div className={styles.groupHead}>
                <Photo
                  asset={group.assetId}
                  ratio="4 / 5"
                  sizes="5rem"
                  parallax={false}
                  className={styles.groupPhoto}
                  decorative
                />
                <div className={styles.groupText}>
                  <h2 id={`${group.anchor}-heading`}>{group.title}</h2>
                  <p>{group.summary}</p>
                </div>
              </div>

              <Grid gap={4} min="16rem">
                {group.services.map((service) => {
                  const availability = AVAILABILITY_TAG[service.availability];
                  const planned = releaseLabel(service.release);
                  return (
                    <PhotoCard
                      key={service.slug}
                      asset={service.assetId}
                      ratio={service.tightCrop ? '1 / 1' : '4 / 3'}
                      href={`/services/${service.slug}/`}
                      title={service.title}
                      meta={
                        <>
                          <Tag tone={availability.tone}>{availability.label}</Tag>
                          {planned ? <Tag>{planned}</Tag> : null}
                        </>
                      }
                    >
                      {service.summary}
                    </PhotoCard>
                  );
                })}
                {group.showHelp ? (
                  <IconTile
                    href="/help/"
                    icon={<LifeBuoy />}
                    title={HELP_TILE.title}
                    hint={HELP_TILE.hint}
                  />
                ) : null}
              </Grid>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
