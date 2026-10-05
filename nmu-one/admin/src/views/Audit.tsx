'use client';

import { useState } from 'react';
import { Empty, PageHeader, TableWrap } from '@/components/ui';
import { when } from '@/lib/format';
import { OPERATOR_ROLE_LABELS } from '@/lib/operators';
import { isLive, useConsole } from '@/lib/store';

export function Audit() {
  const data = useConsole();
  const [who, setWho] = useState('all');
  const entries = data.audit.filter((a) => who === 'all' || a.operatorId === who);
  const op = (id: string) => data.operators.find((o) => o.id === id);

  return (
    <>
      <PageHeader
        eyebrow="Trust"
        title="Audit log"
        description={
          isLive
            ? 'Every change made in the console: who, what and when, as recorded by the server. Entries can’t be edited or deleted.'
            : 'Every change made in the console: who, what and when. Entries can’t be edited or deleted here. (Reset demo starts a fresh demo log in this browser.)'
        }
      />
      <div className="field" style={{ maxWidth: 320, marginBottom: 16 }}>
        <label htmlFor="audit-who">Operator</label>
        <select id="audit-who" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="all">Everyone</option>
          {data.operators.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      {entries.length === 0 ? (
        <Empty title="No entries">This operator hasn’t changed anything yet.</Empty>
      ) : (
        <TableWrap label="Audit log">
          <table>
            <caption className="visually-hidden">Audit log</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Action</th>
                <th scope="col">Item</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((a) => {
                const o = op(a.operatorId);
                return (
                  <tr key={a.id}>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>
                      {when(a.at)}
                    </td>
                    <td>
                      <div className="strong">{o?.name ?? a.operatorId}</div>
                      <div className="cell-sub">{o ? OPERATOR_ROLE_LABELS[o.role] : ''}</div>
                    </td>
                    <td>
                      {a.action.startsWith('EMERGENCY') ? (
                        <strong className="error-text">{a.action}</strong>
                      ) : (
                        a.action
                      )}
                    </td>
                    <td>{a.target}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
