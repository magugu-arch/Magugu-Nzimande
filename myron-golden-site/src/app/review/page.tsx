import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageHero } from '@/components/layout/PageHero';
import { Pill, Section } from '@/components/ui/Section';
import { assetList } from '@/content/assets';
import { bio } from '@/content/bio';
import { books } from '@/content/books';
import { events } from '@/content/events';
import { content } from '@/content/learn';
import { programs } from '@/content/programs';
import { socialAccounts } from '@/content/site';
import { demoEnquiries, testimonials } from '@/content/testimonials';
import { IS_PREVIEW } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Content review',
  robots: { index: false, follow: false },
};

/**
 * The approval checklist made visible (brief §11, §13): every record's
 * status, source, last review and what is still unconfirmed, plus the asset
 * register. Preview only — in production this route does not exist.
 */
export default function ReviewPage() {
  if (!IS_PREVIEW) notFound();

  const outstanding =
    [...programs, ...books, ...events, ...content, ...testimonials].reduce(
      (n, r) => n + r.needsConfirmation.length,
      0,
    ) + bio.needsConfirmation.length;

  return (
    <>
      <PageHero
        variant="plain"
        eyebrow="Preview only"
        title="Content review"
        intro={
          <p>
            Everything that still needs an authorised representative’s confirmation before launch.
            {` ${outstanding} items outstanding.`} This page does not exist in production.
          </p>
        }
      />
      <Section tone="ivory" className="!pt-14">
        <div className="container-site space-y-16">
          <Table
            title="Programs"
            head={['Program', 'Status', 'Source', 'Reviewed', 'Still to confirm']}
            rows={programs.map((p) => [
              <Link key="t" href={`/programs/${p.slug}`} className="font-semibold underline">
                {p.title}
              </Link>,
              <StatusTag key="s" value={p.status} />,
              <Source key="src" value={p.source} />,
              p.lastReviewed,
              p.needsConfirmation.join('; ') || '—',
            ])}
          />
          <Table
            title="Books"
            head={['Book', 'Status', 'Cover', 'Reviewed', 'Still to confirm']}
            rows={books.map((b) => [
              b.title,
              <StatusTag key="s" value={b.status} />,
              b.cover ? 'Placeholder mock-up' : 'None',
              b.lastReviewed,
              b.needsConfirmation.join('; '),
            ])}
          />
          <Table
            title="Biography"
            head={['Item', 'Status', 'Source', 'Reviewed', 'Still to confirm']}
            rows={[
              [
                'Short and long bio, speaker introduction',
                bio.approved ? 'Approved' : 'Draft',
                <Source key="src" value={bio.source} />,
                bio.lastReviewed,
                bio.needsConfirmation.join('; '),
              ],
            ]}
          />
          <Table
            title="Social accounts"
            head={['Platform', 'Handle', 'Verified', 'By', 'On']}
            rows={socialAccounts.map((s) => [
              s.platform,
              s.handle ?? '—',
              s.verified ? 'Yes — shown on site' : 'No — hidden until confirmed',
              s.verifiedBy ?? '—',
              s.verifiedOn ?? '—',
            ])}
          />
          <Table
            title="Events (all demo)"
            head={['Event', 'Start', 'Zone', 'Demo', 'Still to confirm']}
            rows={events.map((e) => [
              e.title,
              e.start,
              e.timezone,
              e.isDemo ? 'Yes' : 'No',
              e.needsConfirmation.join('; '),
            ])}
          />
          <Table
            title="Learning library (all demo)"
            head={['Item', 'Type', 'Video id', 'Demo', 'Still to confirm']}
            rows={content.map((c) => [
              c.title,
              c.type,
              c.youtubeId ?? 'None yet',
              c.isDemo ? 'Yes' : 'No',
              c.needsConfirmation.join('; '),
            ])}
          />
          <Table
            title="Testimonials"
            head={['Slot', 'Approved', 'Consent', 'Demo', 'Still to confirm']}
            rows={testimonials.map((t) => [
              t.id,
              t.approved ? 'Yes' : 'No',
              t.consentReference ?? 'None',
              t.isDemo ? 'Yes' : 'No',
              t.needsConfirmation.join('; '),
            ])}
          />
          <Table
            title={`Asset register (${assetList.length} images)`}
            head={['ID', 'File', 'Status', 'Placement', 'Production note']}
            rows={assetList.map((a) => [
              a.id,
              a.file,
              a.status.replaceAll('-', ' '),
              a.placement,
              a.note,
            ])}
          />
          <Table
            title="Inbound enquiries (demo)"
            head={['Category', 'From', 'Summary', 'Received', 'Status']}
            rows={demoEnquiries.map((e) => [
              e.category,
              [e.name, e.organisation].filter(Boolean).join(', '),
              e.summary,
              e.createdAt.slice(0, 10),
              e.status,
            ])}
          />
        </div>
      </Section>
    </>
  );
}

function StatusTag({ value }: { value: string }) {
  return <Pill tone="light">{value}</Pill>;
}

function Source({ value }: { value: string }) {
  return value.startsWith('http') ? (
    <a href={value} className="break-all underline" target="_blank" rel="noopener noreferrer">
      {value.replace(/^https?:\/\/(www\.)?/, '')}
    </a>
  ) : (
    <>{value}</>
  );
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <section>
      <h2 className="type-display-sm">{title}</h2>
      <div className="mt-5 overflow-x-auto rounded-2xl bg-white ring-1 ring-ink/10">
        <table className="w-full min-w-[46rem] text-left text-[0.875rem]">
          <thead className="bg-stone/60">
            <tr>
              {head.map((h) => (
                <th key={h} scope="col" className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/[0.07]">
            {rows.map((row, i) => (
              <tr key={i} className="align-top">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3 text-ink/80">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
