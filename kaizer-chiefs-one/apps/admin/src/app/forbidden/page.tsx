import Link from 'next/link';
import { first, PageHead } from '@/components/ui';

export default async function Forbidden({ searchParams }: PageProps<'/forbidden'>) {
  const need = first((await searchParams).need);
  return (
    <main className="main" style={{ maxWidth: 640, margin: '0 auto' }}>
      <PageHead eyebrow="Access" lead="Not for" accent="your role." />
      <p className="muted">
        This area needs the <code>{need ?? 'required'}</code> permission. Ask a super admin if you
        need it for your work.
      </p>
      <Link href="/">Back to the dashboard</Link>
    </main>
  );
}
