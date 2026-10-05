'use client';

import { ROLES } from '@core/domain/models';
import { CAPABILITIES, CAPABILITY_LABELS } from '@core/permissions/policy';
import { Badge, Card, PageHeader, ReadOnlyNote, TableWrap } from '@/components/ui';
import { ROLE_LABELS } from '@/lib/audience';
import { grantFor } from '@/lib/grants';
import {
  ACTION_LABELS,
  allows,
  OPERATOR_PERMISSIONS,
  OPERATOR_ROLE_LABELS,
  type OperatorAction,
} from '@/lib/operators';
import { currentOperator, setOperatorRole, useConsole } from '@/lib/store';
import type { OperatorRole } from '@/lib/types';

const OPERATOR_ROLES = Object.keys(OPERATOR_ROLE_LABELS) as OperatorRole[];
const ACTIONS = Object.keys(ACTION_LABELS) as OperatorAction[];

export function Roles() {
  const data = useConsole();
  const op = currentOperator(data);
  const canManage = allows(op, 'manage-roles');

  return (
    <>
      <PageHeader
        eyebrow="Trust"
        title="Roles & permissions"
        description="Two sets of rules: what each kind of NMU ONE user can see in the app, and what each console operator can do here. Both are enforced in code, not just hidden in the interface."
      />
      <div className="stack">
        <Card
          title="Console operators"
          description="Operators publish only into their own areas. Nobody can approve their own work or change their own role."
        >
          {!canManage ? (
            <ReadOnlyNote>Only a Platform administrator can change roles.</ReadOnlyNote>
          ) : null}
          <div style={{ marginTop: 8 }}>
            <TableWrap label="Console operators">
              <table>
                <caption className="visually-hidden">Console operators</caption>
                <thead>
                  <tr>
                    <th scope="col">Operator</th>
                    <th scope="col">Department</th>
                    <th scope="col">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {data.operators.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <div className="cell-title">
                          {o.name}
                          {o.id === op.id ? ' (you)' : ''}
                        </div>
                        <div className="cell-sub">{o.title}</div>
                      </td>
                      <td className="small">{o.department}</td>
                      <td>
                        {canManage && o.id !== op.id ? (
                          <>
                            <label className="visually-hidden" htmlFor={`role-${o.id}`}>
                              Role for {o.name}
                            </label>
                            <select
                              id={`role-${o.id}`}
                              value={o.role}
                              onChange={(e) =>
                                setOperatorRole(o.id, e.target.value as OperatorRole)
                              }
                            >
                              {OPERATOR_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {OPERATOR_ROLE_LABELS[r]}
                                </option>
                              ))}
                            </select>
                          </>
                        ) : (
                          OPERATOR_ROLE_LABELS[o.role]
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
        </Card>

        <Card title="What each operator role can do">
          <TableWrap label="Operator role permissions">
            <table className="matrix">
              <caption className="visually-hidden">Operator role permissions</caption>
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  {OPERATOR_ROLES.map((r) => (
                    <th scope="col" key={r}>
                      {OPERATOR_ROLE_LABELS[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACTIONS.map((a) => (
                  <tr key={a}>
                    <th scope="row">{ACTION_LABELS[a]}</th>
                    {OPERATOR_ROLES.map((r) => (
                      <td key={r}>
                        {OPERATOR_PERMISSIONS[r].includes(a) ? (
                          <Badge tone="success">Yes</Badge>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>

        <Card
          title="What each NMU ONE user can see"
          description="Read live from the app’s permission policy. Parents see nothing about a student unless that student shares it."
        >
          <TableWrap label="App permissions by role">
            <table className="matrix">
              <caption className="visually-hidden">App permissions by role</caption>
              <thead>
                <tr>
                  <th scope="col">Capability</th>
                  {ROLES.map((r) => (
                    <th scope="col" key={r}>
                      {ROLE_LABELS[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPABILITIES.map((c) => (
                  <tr key={c}>
                    <th scope="row">{CAPABILITY_LABELS[c]}</th>
                    {ROLES.map((r) => {
                      const g = grantFor(r, c);
                      return (
                        <td key={r} title={g.text}>
                          {g.short === '—' ? (
                            <span className="muted">
                              —<span className="visually-hidden"> {g.text}</span>
                            </span>
                          ) : (
                            <Badge tone={g.tone}>
                              {g.short}
                              {g.short !== 'Yes' ? (
                                <span className="visually-hidden">: {g.text}</span>
                              ) : null}
                            </Badge>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>
    </>
  );
}
