'use client';

import { useState } from 'react';
import type { CampusId, Role } from '@core/domain/models';
import { Card, PageHeader, ReadOnlyNote, TableWrap } from '@/components/ui';
import {
  ALL_FACULTIES,
  CAMPUSES,
  describeSegment,
  estimateReach,
  fmt,
  ROLE_LABELS,
} from '@/lib/audience';
import { allows } from '@/lib/operators';
import { currentOperator, saveSegment, useConsole } from '@/lib/store';

const ROLES: Role[] = ['student', 'staff', 'parent', 'alumni'];

export function Audience() {
  const data = useConsole();
  const op = currentOperator(data);
  const can = allows(op, 'manage-audiences');
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<Role[]>(['student']);
  const [campuses, setCampuses] = useState<CampusId[] | 'all'>('all');
  const [faculties, setFaculties] = useState<string[] | 'all'>('all');
  const [residenceOnly, setResidenceOnly] = useState(false);

  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  const draft = { roles, campuses, faculties, residenceOnly };
  const reach = estimateReach(draft);
  const name_ = (id: string) => data.operators.find((o) => o.id === id)?.name ?? id;

  return (
    <>
      <PageHeader
        eyebrow="Communicate"
        title="Audiences"
        description="Reusable groups to send to. The console only ever shows how many people an audience reaches — never who they are."
      />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title="Saved audiences">
          <TableWrap label="Saved audiences">
            <table>
              <caption className="visually-hidden">Saved audiences</caption>
              <thead>
                <tr>
                  <th scope="col">Audience</th>
                  <th scope="col" className="num">
                    Reach
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.segments.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="cell-title">{s.name}</div>
                      <div className="cell-sub">
                        {describeSegment(s)} · by {name_(s.createdBy)}
                      </div>
                    </td>
                    <td className="num">{fmt(estimateReach(s))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <p className="hint" style={{ marginTop: 8 }}>
            Reach is estimated from a synthetic population for the demo.
          </p>
        </Card>

        <Card title="Build an audience">
          {!can ? (
            <ReadOnlyNote>Your role can use audiences but not create them.</ReadOnlyNote>
          ) : null}
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const r = saveSegment({ name, ...draft });
              if (r.ok) setName('');
            }}
          >
            <fieldset disabled={!can} className="stack">
              <div className="field">
                <label htmlFor="seg-name">Name</label>
                <input
                  id="seg-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <fieldset>
                <legend>People</legend>
                <div className="row">
                  {ROLES.map((r) => (
                    <label className="check" key={r}>
                      <input
                        type="checkbox"
                        checked={roles.includes(r)}
                        onChange={() => setRoles(toggle(roles, r))}
                      />
                      {ROLE_LABELS[r]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Campuses</legend>
                <div className="row">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={campuses === 'all'}
                      onChange={(e) => setCampuses(e.target.checked ? 'all' : ['south'])}
                    />
                    All campuses
                  </label>
                  {campuses !== 'all'
                    ? CAMPUSES.map((c) => (
                        <label className="check" key={c.id}>
                          <input
                            type="checkbox"
                            checked={campuses.includes(c.id)}
                            onChange={() => setCampuses(toggle(campuses, c.id))}
                          />
                          {c.name}
                        </label>
                      ))
                    : null}
                </div>
              </fieldset>
              <fieldset>
                <legend>Faculties (students and staff)</legend>
                <div className="row">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={faculties === 'all'}
                      onChange={(e) => setFaculties(e.target.checked ? 'all' : [ALL_FACULTIES[0]!])}
                    />
                    All faculties
                  </label>
                  {faculties !== 'all'
                    ? ALL_FACULTIES.map((f) => (
                        <label className="check" key={f}>
                          <input
                            type="checkbox"
                            checked={faculties.includes(f)}
                            onChange={() => setFaculties(toggle(faculties, f))}
                          />
                          {f}
                        </label>
                      ))
                    : null}
                </div>
              </fieldset>
              <label className="check">
                <input
                  type="checkbox"
                  checked={residenceOnly}
                  onChange={(e) => setResidenceOnly(e.target.checked)}
                />
                Only students living in residence
              </label>
            </fieldset>
            <div className="notice tone-info" aria-live="polite">
              <strong>About {fmt(reach)} people</strong>
              <span className="small">
                {reach === 0 ? 'This audience reaches nobody — widen it.' : 'Estimated reach'}
              </span>
            </div>
            {can ? (
              <div>
                <button type="submit" className="btn primary">
                  Save audience
                </button>
              </div>
            ) : null}
          </form>
        </Card>
      </div>
    </>
  );
}
