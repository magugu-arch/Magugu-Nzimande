'use client';

import { useState } from 'react';
import type { EventCategory } from '@core/domain/models';
import {
  Badge,
  Dialog,
  Empty,
  FilterTabs,
  PageHeader,
  ReadOnlyNote,
  TableWrap,
} from '@/components/ui';
import { fmt, pct } from '@/lib/audience';
import { fromLocalInput, rands, when } from '@/lib/format';
import { EVENT_STATUS } from '@/lib/labels';
import { allows } from '@/lib/operators';
import { createEvent, currentOperator, setEventStatus, useConsole } from '@/lib/store';
import type { AdminEvent } from '@/lib/types';

const CATEGORIES: EventCategory[] = [
  'music',
  'careers',
  'innovation',
  'wellbeing',
  'sport',
  'learning',
];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

type Filter = 'upcoming' | 'pending-approval' | 'cancelled';

export function Events() {
  const data = useConsole();
  const op = currentOperator(data);
  const can = allows(op, 'manage-events');
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [open, setOpen] = useState(false);
  const blank = {
    title: '',
    category: 'learning' as EventCategory,
    start: '',
    venue: '',
    capacity: 100,
    ticketing: 'free-ticket' as AdminEvent['ticketing'],
    priceRands: null as number | null,
    organiser: op.department,
  };
  const [form, setForm] = useState(blank);

  const shown = data.events
    .filter((e) =>
      filter === 'upcoming'
        ? e.status === 'published' || e.status === 'draft'
        : e.status === filter,
    )
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <>
      <PageHeader
        eyebrow="Campus life"
        title="Events"
        description="Events published here appear in NMU ONE with tickets and calendar links. New events are approved before they go live."
        actions={
          can ? (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setForm({ ...blank, organiser: op.department });
                setOpen(true);
              }}
            >
              New event
            </button>
          ) : null
        }
      />
      {!can ? (
        <ReadOnlyNote>Your role can see events but not create or change them.</ReadOnlyNote>
      ) : null}
      <FilterTabs<Filter>
        label="Filter events"
        value={filter}
        onChange={setFilter}
        options={[
          {
            id: 'upcoming',
            label: 'Published',
            count: data.events.filter((e) => e.status === 'published').length,
          },
          {
            id: 'pending-approval',
            label: 'Awaiting approval',
            count: data.events.filter((e) => e.status === 'pending-approval').length,
          },
          {
            id: 'cancelled',
            label: 'Cancelled',
            count: data.events.filter((e) => e.status === 'cancelled').length,
          },
        ]}
      />
      {shown.length === 0 ? (
        <Empty title="No events here">Events in this state will appear here.</Empty>
      ) : (
        <TableWrap label="Events">
          <table>
            <caption className="visually-hidden">Events</caption>
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">When</th>
                <th scope="col">Tickets</th>
                <th scope="col">Price</th>
                <th scope="col">Status</th>
                {can ? (
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="cell-title">{e.title}</div>
                    <div className="cell-sub">
                      {e.venue} · {e.organiser}
                    </div>
                  </td>
                  <td className="small">{when(e.start)}</td>
                  <td style={{ minWidth: 160 }}>
                    {e.ticketing === 'open-entry' ? (
                      <span className="small muted">Open entry · {fmt(e.capacity)} capacity</span>
                    ) : (
                      <div className="meter">
                        <span className="small">
                          <strong>{fmt(e.ticketsIssued)}</strong> of {fmt(e.capacity)} (
                          {pct(e.ticketsIssued, e.capacity)})
                          {e.ticketsIssued >= e.capacity ? ' · Full' : ''}
                        </span>
                        <div className="meter-track" aria-hidden="true">
                          <div
                            className="meter-fill"
                            style={{
                              width: pct(Math.min(e.ticketsIssued, e.capacity), e.capacity),
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="small">{e.priceRands ? rands(e.priceRands * 100) : 'Free'}</td>
                  <td>
                    <Badge tone={EVENT_STATUS[e.status].tone}>{EVENT_STATUS[e.status].label}</Badge>
                  </td>
                  {can ? (
                    <td>
                      {e.status === 'published' || e.status === 'pending-approval' ? (
                        <button
                          type="button"
                          className="btn small danger"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Cancel “${e.title}”? Ticket holders will be told in NMU ONE.`,
                              )
                            )
                              setEventStatus(e.id, 'cancelled');
                          }}
                        >
                          Cancel<span className="visually-hidden"> {e.title}</span>
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Dialog
        open={open}
        title="New event"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={async () => {
                const r = await createEvent({ ...form, start: fromLocalInput(form.start) ?? '' });
                if (r.ok) setOpen(false);
              }}
            >
              Submit for approval
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="ev-title">Title</label>
          <input
            id="ev-title"
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ev-cat">Category</label>
            <select
              id="ev-cat"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as EventCategory })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {cap(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ev-start">Starts (SAST)</label>
            <input
              id="ev-start"
              type="datetime-local"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="ev-venue">Venue</label>
            <input
              id="ev-venue"
              type="text"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="ev-cap">Capacity</label>
            <input
              id="ev-cap"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="ev-ticketing">Entry</label>
            <select
              id="ev-ticketing"
              value={form.ticketing}
              onChange={(e) =>
                setForm({ ...form, ticketing: e.target.value as AdminEvent['ticketing'] })
              }
            >
              <option value="free-ticket">Free ticket</option>
              <option value="paid-ticket">Paid ticket</option>
              <option value="open-entry">Open entry, no ticket</option>
            </select>
          </div>
          {form.ticketing === 'paid-ticket' ? (
            <div className="field">
              <label htmlFor="ev-price">Price (rand)</label>
              <input
                id="ev-price"
                type="number"
                min={1}
                value={form.priceRands ?? ''}
                onChange={(e) =>
                  setForm({ ...form, priceRands: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="ev-org">Organiser</label>
          <input
            id="ev-org"
            type="text"
            value={form.organiser}
            onChange={(e) => setForm({ ...form, organiser: e.target.value })}
          />
        </div>
      </Dialog>
    </>
  );
}
