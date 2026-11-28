import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaymentReturn } from './PaymentReturn';

export const metadata: Metadata = { title: 'Payment', robots: { index: false, follow: false } };

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentReturn id={id} />;
}

export default function ReturnPage({ params }: PageProps<'/booking/[id]/return'>) {
  return (
    <div className="container" style={{ paddingBlock: 'clamp(28px, 6vw, 80px)', display: 'grid', justifyItems: 'center' }}>
      <Suspense fallback={null}>
        <Inner params={params} />
      </Suspense>
    </div>
  );
}
