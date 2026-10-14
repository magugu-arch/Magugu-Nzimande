import Link from 'next/link';
import type { ReactNode } from 'react';
import { OutboundLink } from '../ui/OutboundLink';
import { Pill, Section } from '../ui/Section';
import { PageHero } from './PageHero';

/**
 * Legal pages hold the owner-approved documents (brief §11). No legal text
 * is written here: until the approved version is supplied, each page says so
 * and points to the current official policy.
 */
export function PolicyPage({
  title,
  path,
  summary,
  officialUrl,
  children,
}: {
  title: string;
  path: string;
  summary: string;
  officialUrl: string | null;
  children?: ReactNode;
}) {
  return (
    <>
      <PageHero
        variant="plain"
        eyebrow="Legal"
        title={title}
        intro={<p>{summary}</p>}
        crumbs={[
          { name: 'Home', path: '/' },
          { name: title, path },
        ]}
      />
      <Section tone="ivory" className="!py-16" labelledBy="policy-status">
        <div className="container-site max-w-3xl">
          <Pill tone="light">Awaiting the owner-approved document</Pill>
          <h2 id="policy-status" className="type-display-sm mt-5">
            The approved {title.toLowerCase()} will be published here
          </h2>
          <div className="prose-site mt-5 text-ink/80">
            {officialUrl ? (
              <p>
                Until then, the current version is on the official site:{' '}
                <OutboundLink
                  href={officialUrl}
                  campaign="legal"
                  className="font-semibold underline"
                >
                  read the official {title.toLowerCase()}
                </OutboundLink>
                .
              </p>
            ) : (
              <p>
                Until then, see the policies linked from the{' '}
                <OutboundLink
                  href="https://myrongolden.com/"
                  campaign="legal"
                  className="font-semibold underline"
                >
                  official site
                </OutboundLink>
                , or{' '}
                <Link href="/contact?topic=general" className="font-semibold underline">
                  contact the team
                </Link>{' '}
                with any question.
              </p>
            )}
            {children}
          </div>
        </div>
      </Section>
    </>
  );
}
