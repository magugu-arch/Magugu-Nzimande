'use client';

import { Badge, Card, PageHeader, ReadOnlyNote, Switch } from '@/components/ui';
import { fmt } from '@/lib/audience';
import { rands } from '@/lib/format';
import { allows } from '@/lib/operators';
import { currentOperator, setItemAvailable, setVendor, useConsole } from '@/lib/store';

export function Commerce() {
  const data = useConsole();
  const op = currentOperator(data);
  const can = allows(op, 'manage-commerce');

  return (
    <>
      <PageHeader
        eyebrow="Campus life"
        title="Commerce"
        description="Vendors, menus and order-ahead. Changes show in NMU ONE’s Food & campus shops straight away: a sold-out item can’t be ordered, a paused vendor takes no new orders."
      />
      {!can ? (
        <div style={{ marginBottom: 16 }}>
          <ReadOnlyNote>
            Your role can see vendors but not change them. Switch to the Commerce manager to try it.
          </ReadOnlyNote>
        </div>
      ) : null}
      <div className="grid-2">
        {data.vendors.map((v) => {
          const soldOut = v.items.filter((i) => !i.available).length;
          return (
            <Card
              key={v.id}
              title={v.name}
              description={v.location}
              action={
                <Badge tone={!v.open ? 'neutral' : v.acceptingOrders ? 'success' : 'warning'}>
                  {!v.open ? 'Closed' : v.acceptingOrders ? 'Taking orders' : 'Orders paused'}
                </Badge>
              }
            >
              <div className="stack">
                <div className="grid-3">
                  <div className="stat">
                    <span className="stat-label">Orders today</span>
                    <span className="stat-value">{fmt(v.ordersToday)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Average preparation</span>
                    <span className="stat-value">{v.averagePrepMinutes} min</span>
                  </div>
                </div>
                <div className="row">
                  <Switch
                    label={
                      <>
                        Open<span className="visually-hidden"> — {v.name}</span>
                      </>
                    }
                    checked={v.open}
                    disabled={!can}
                    onChange={(open) => setVendor(v.id, { open })}
                  />
                  <Switch
                    label={
                      <>
                        Taking order-ahead<span className="visually-hidden"> — {v.name}</span>
                      </>
                    }
                    checked={v.acceptingOrders}
                    disabled={!can || !v.open}
                    onChange={(acceptingOrders) => setVendor(v.id, { acceptingOrders })}
                  />
                  <div className="field" style={{ maxWidth: 160 }}>
                    <label htmlFor={`prep-${v.id}`}>
                      Preparation time (min)<span className="visually-hidden"> — {v.name}</span>
                    </label>
                    <input
                      key={v.averagePrepMinutes}
                      id={`prep-${v.id}`}
                      type="number"
                      min={1}
                      max={90}
                      disabled={!can}
                      defaultValue={v.averagePrepMinutes}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (n !== v.averagePrepMinutes) setVendor(v.id, { averagePrepMinutes: n });
                      }}
                    />
                  </div>
                </div>
                <details>
                  <summary className="strong" style={{ cursor: 'pointer', minHeight: 32 }}>
                    Menu · {v.items.length} items{soldOut ? ` · ${soldOut} sold out` : ''}
                  </summary>
                  <ul className="list" style={{ marginTop: 10 }}>
                    {v.items.map((i) => (
                      <li key={i.id} className="spread">
                        <span>
                          <span className="strong">{i.name}</span>{' '}
                          <span className="muted small">{rands(i.priceCents)}</span>
                          {!i.available ? (
                            <>
                              {' '}
                              <Badge tone="warning">Sold out</Badge>
                            </>
                          ) : null}
                        </span>
                        <Switch
                          label={
                            <>
                              Available<span className="visually-hidden"> — {i.name}</span>
                            </>
                          }
                          checked={i.available}
                          disabled={!can}
                          onChange={(available) => setItemAvailable(v.id, i.id, available)}
                        />
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="hint" style={{ marginTop: 16 }}>
        Order volumes are synthetic. Payments, refunds and vendor settlement follow the university’s
        commercial agreements and are not configured in this prototype.
      </p>
    </>
  );
}
