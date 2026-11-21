'use client';

import { EmptyState, ErrorState, LoadingState, OfflineState } from '@hao/design-system';
import type { GatewayError } from '@hao/shared-types';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

export interface QueryBoundaryProps<T> {
  query: UseQueryResult<T, GatewayError>;
  /** Announced to screen readers while loading, e.g. "Loading your applications". */
  loadingLabel?: string;
  loadingRows?: number;
  /** Return true when the data counts as empty. */
  isEmpty?: (data: T) => boolean;
  /** What to show when empty. Always include a next step. */
  empty?: ReactNode;
  headingLevel?: 2 | 3;
  children: (data: T) => ReactNode;
}

/**
 * Renders the right state for a query: loading, offline, error with retry,
 * empty, or the content. Use it for every data-driven region so no screen has
 * to hand-roll these states.
 */
export function QueryBoundary<T>({
  query,
  loadingLabel = 'Loading',
  loadingRows = 3,
  isEmpty,
  empty,
  headingLevel = 2,
  children,
}: QueryBoundaryProps<T>) {
  if (query.isPending) return <LoadingState label={loadingLabel} rows={loadingRows} />;

  if (query.isError) {
    const retry = () => void query.refetch();
    if (query.error.category === 'OFFLINE') {
      return (
        <OfflineState onRetry={retry} retrying={query.isFetching} headingLevel={headingLevel} />
      );
    }
    return (
      <ErrorState
        title={query.error.category === 'NOT_FOUND' ? 'We could not find that' : undefined}
        message={query.error.safeMessage}
        traceRef={query.error.traceRef}
        onRetry={query.error.category === 'NOT_FOUND' ? undefined : retry}
        retrying={query.isFetching}
        headingLevel={headingLevel}
      />
    );
  }

  if (isEmpty?.(query.data)) {
    return <>{empty ?? <EmptyState title="Nothing here yet" headingLevel={headingLevel} />}</>;
  }
  return <>{children(query.data)}</>;
}
