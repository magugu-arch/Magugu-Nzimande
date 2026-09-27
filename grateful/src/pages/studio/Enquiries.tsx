import { Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ContactMessage } from '../../../shared/types';
import { adminApi } from '../../lib/adminApi';
import { RequestError } from '../../lib/api';
import { Loading, Notice, Panel, SmallButton } from './ui';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Messages from the contact form. Every one is also emailed to the studio; this is the list to work through. */
export function Enquiries({ onChange }: { onChange: () => void }) {
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  useEffect(() => {
    let live = true;
    adminApi.messages().then(
      (m) => live && setMessages(m),
      (e: unknown) => live && setError(e instanceof RequestError ? e.message : 'Enquiries could not be loaded.'),
    );
    return () => {
      live = false;
    };
  }, []);

  async function mark(m: ContactMessage, status: ContactMessage['status']) {
    try {
      await adminApi.setMessageStatus(m.id, status);
      setMessages((list) => list?.map((x) => (x.id === m.id ? { ...x, status } : x)) ?? null);
      onChange();
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Could not update. Please try again.');
    }
  }

  const shown = (messages ?? []).filter((m) => filter === 'all' || m.status !== 'archived');

  return (
    <Panel
      title="Enquiries"
      action={
        <label className="flex min-h-11 items-center gap-2 font-sans text-sm">
          <input type="checkbox" checked={filter === 'all'} onChange={(e) => setFilter(e.target.checked ? 'all' : 'open')} className="size-4 accent-white" />
          Show archived
        </label>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}
      {!messages && !error && <Loading />}
      {messages && shown.length === 0 && <p className="font-sans text-sm opacity-60">No enquiries to show.</p>}
      <ul className="space-y-3">
        {shown.map((m) => (
          <li key={m.id} className={`border px-4 py-3 ${m.status === 'new' ? 'border-white' : 'border-white/20'} ${m.status === 'archived' ? 'opacity-50' : ''}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-serif text-xl">
                {m.name}
                {m.status === 'new' && <span className="ui-label ml-2 align-middle">New</span>}
                {m.status === 'replied' && <span className="ml-2 align-middle font-sans text-xs opacity-60">Replied</span>}
              </p>
              <p className="font-sans text-xs tabular-nums opacity-60">{when(m.createdAt)}</p>
            </div>
            {m.subject && <p className="font-sans text-sm opacity-70">{m.subject}</p>}
            <p className="mt-2 font-sans text-sm whitespace-pre-line">{m.message}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your enquiry to Grateful')}`} className="inline-flex min-h-11 items-center gap-1.5 px-1 font-sans text-sm break-all hover:underline">
                <Mail aria-hidden className="size-4" /> {m.email}
              </a>
              {m.phone && <span className="font-sans text-sm opacity-70">{m.phone}</span>}
              <span className="ml-auto flex gap-1">
                {m.status !== 'replied' && <SmallButton onClick={() => void mark(m, 'replied')}>Mark replied</SmallButton>}
                {m.status !== 'archived' ? (
                  <SmallButton variant="text" onClick={() => void mark(m, 'archived')}>
                    Archive
                  </SmallButton>
                ) : (
                  <SmallButton variant="text" onClick={() => void mark(m, 'new')}>
                    Restore
                  </SmallButton>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
