'use client';

import { useState } from 'react';
import { BarChart } from '@/components/charts';
import { Card, Empty, FilterTabs, PageHeader, Stat } from '@/components/ui';
import { fmt, metricsFor, pct } from '@/lib/audience';
import { CATEGORY_LABELS } from '@/lib/labels';
import { useConsole } from '@/lib/store';
import { clock } from '@core/time/clock';

type Range = '7' | '30' | 'all';

export function Analytics() {
  const data = useConsole();
  const [range, setRange] = useState<Range>('30');
  const now = clock.now();
  const since = range === 'all' ? 0 : now.getTime() - Number(range) * 86_400_000;

  const sent = data.campaigns
    .filter((c) => c.status === 'sent' && c.sentAt && new Date(c.sentAt).getTime() >= since)
    .map((c) => ({
      c,
      m: metricsFor(
        c,
        data.segments.find((s) => s.id === c.segmentId),
        now,
      )!,
    }))
    .filter((x) => x.m);

  const totals = sent.reduce(
    (t, { m }) => ({
      delivered: t.delivered + m.delivered,
      opened: t.opened + m.opened,
      actioned: t.actioned + m.actioned,
    }),
    { delivered: 0, opened: 0, actioned: 0 },
  );

  const byCategory = new Map<string, number>();
  for (const { c, m } of sent)
    byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + m.delivered);

  const ticketed = data.events.filter(
    (e) => e.status === 'published' && e.ticketing !== 'open-entry',
  );

  return (
    <>
      <PageHeader
        eyebrow="Measure"
        title="Analytics"
        description="How notices perform, which events fill and where people order. Totals only — the console never shows what an individual did."
      />
      <FilterTabs<Range>
        label="Time range for notifications"
        value={range}
        onChange={setRange}
        options={[
          { id: '7', label: 'Last 7 days' },
          { id: '30', label: 'Last 30 days' },
          { id: 'all', label: 'All time' },
        ]}
      />
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Stat label="Notifications sent" value={fmt(sent.length)} />
        <Stat label="People reached" value={fmt(totals.delivered)} note="Deliveries, all notices" />
        <Stat label="Open rate" value={pct(totals.opened, totals.delivered)} />
        <Stat
          label="Acted on it"
          value={pct(totals.actioned, totals.opened)}
          note="Of those who opened"
        />
      </div>
      <div className="grid-2">
        <Card title="Open rate by notification" description="Share of deliveries that were opened.">
          {sent.length === 0 ? (
            <Empty title="No notifications sent in this period" />
          ) : (
            <BarChart
              title="Open rate by notification"
              valueHeader="Open rate"
              max={100}
              data={[...sent]
                .sort((a, b) => b.m.opened / b.m.delivered - a.m.opened / a.m.delivered)
                .map(({ c, m }) => ({
                  id: c.id,
                  label: c.title,
                  value: (m.opened / Math.max(1, m.delivered)) * 100,
                  display: pct(m.opened, m.delivered),
                  detail: `${fmt(m.opened)} of ${fmt(m.delivered)} opened · ${fmt(m.actioned)} acted`,
                }))}
            />
          )}
        </Card>
        <Card title="People reached by category" description="Deliveries in this period.">
          {byCategory.size === 0 ? (
            <Empty title="No deliveries in this period" />
          ) : (
            <BarChart
              title="People reached by category"
              valueHeader="Deliveries"
              data={[...byCategory.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([cat, n]) => ({
                  id: cat,
                  label: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS],
                  value: n,
                  display: fmt(n),
                }))}
            />
          )}
        </Card>
        <Card
          title="Event ticket uptake"
          description="Tickets issued as a share of capacity, published events."
        >
          {ticketed.length === 0 ? (
            <Empty title="No ticketed events" />
          ) : (
            <BarChart
              title="Event ticket uptake"
              valueHeader="Uptake"
              max={100}
              data={ticketed
                .map((e) => ({ e, share: e.ticketsIssued / Math.max(1, e.capacity) }))
                .sort((a, b) => b.share - a.share)
                .map(({ e, share }) => ({
                  id: e.id,
                  label: e.title,
                  value: share * 100,
                  display: pct(e.ticketsIssued, e.capacity),
                  detail: `${fmt(e.ticketsIssued)} of ${fmt(e.capacity)} tickets`,
                }))}
            />
          )}
        </Card>
        <Card title="Orders today by vendor" description="Order-ahead through NMU ONE.">
          <BarChart
            title="Orders today by vendor"
            valueHeader="Orders"
            data={[...data.vendors]
              .sort((a, b) => b.ordersToday - a.ordersToday)
              .map((v) => ({
                id: v.id,
                label: v.name,
                value: v.ordersToday,
                display: fmt(v.ordersToday),
                detail:
                  v.acceptingOrders && v.open
                    ? `Taking orders · ~${v.averagePrepMinutes} min`
                    : 'Not taking orders now',
              }))}
          />
        </Card>
      </div>
      <p className="hint" style={{ marginTop: 16 }}>
        All figures are synthetic demo data. The time range applies to notifications; events and
        orders show current totals.
      </p>
    </>
  );
}
