import type { Metadata } from 'next';
import { roles } from '@scarlets/domain';
import { attemptRewardAdjustmentAction, changeRoleAction } from '@/actions/roles';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { Card, Chip, DemoTag, Denied, PageHeader, TableWrap } from '@/components/ui';
import { getStore } from '@/lib/instance';
import {
  assignableRoles,
  humanRolesWith,
  isConsoleRole,
  mayAct,
  permissionMatrix,
  roleLabels,
  sectionsFor,
} from '@/lib/rbac';
import { requireActor } from '@/lib/session';

export const metadata: Metadata = { title: 'Roles' };

export default async function RolesPage() {
  const actor = await requireActor();
  if (!mayAct(actor.role, 'roles.manage')) {
    return <Denied actor={actor} permission="roles.manage" section="Roles" />;
  }
  const staff = getStore().listStaff();
  const matrix = permissionMatrix();
  const rewardHolders = humanRolesWith('rewards.adjust');

  return (
    <div className="stack">
      <PageHeader eyebrow="Roles" title="Staff roles and permissions">
        Who can do what in this console. A role change takes effect on that person’s next click, and
        is written to the audit log.
      </PageHeader>

      <Card title="Staff accounts" id="staff" aside={<DemoTag />}>
        <TableWrap label="Staff accounts">
          <table>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Role</th>
                <th scope="col">Can open</th>
                <th scope="col">Change role</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((user) => {
                const isSelf = user.id === actor.id;
                return (
                  <tr key={user.id}>
                    <th scope="row">
                      {user.name}
                      {isSelf ? ' (you)' : ''}
                      <span className="cell-sub">{user.email}</span>
                    </th>
                    <td>
                      <Chip tone={isConsoleRole(user.role) ? 'neutral' : 'strong'}>
                        {roleLabels[user.role]}
                      </Chip>
                      {user.system ? (
                        <span className="cell-sub">System account. Cannot sign in.</span>
                      ) : null}
                      {user.role === 'supporter' ? (
                        <span className="cell-sub">No console access.</span>
                      ) : null}
                    </td>
                    <td>
                      {sectionsFor(user.role)
                        .map((section) => section.label)
                        .join(', ') || <span className="meta">Nothing</span>}
                    </td>
                    <td>
                      {user.system ? (
                        <span className="meta">Not a person: its role cannot change.</span>
                      ) : isSelf ? (
                        <span className="meta">
                          You cannot change your own role. Ask another club admin.
                        </span>
                      ) : (
                        <ActionForm key={user.role} action={changeRoleAction} className="row">
                          <input type="hidden" name="id" value={user.id} />
                          <label className="sr-only" htmlFor={`role-${user.id}`}>
                            New role for {user.name}
                          </label>
                          <select
                            id={`role-${user.id}`}
                            name="role"
                            defaultValue={user.role}
                            style={{ width: 'auto' }}
                          >
                            {assignableRoles.map((role) => (
                              <option key={role} value={role}>
                                {role === 'supporter' ? 'No console access' : roleLabels[role]}
                              </option>
                            ))}
                          </select>
                          <SubmitButton aria-label={`Change role of ${user.name}`}>
                            Change
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
        <p className="hint" style={{ marginTop: 'var(--s-md)' }}>
          The service role is for systems and cannot be given to a person. “No console access” sets
          the account to supporter.
        </p>
      </Card>

      <Card title="Permission matrix" eyebrow="From the shared domain rules" id="matrix">
        <p className="hint" style={{ marginTop: 0, marginBottom: 'var(--s-md)' }}>
          This table is generated from <code>rolePermissions</code> in the domain package, the same
          source the server checks. Supporter and service are shown for completeness: neither can
          sign in to the console.
        </p>
        <TableWrap label="Permission matrix">
          <table className="matrix">
            <thead>
              <tr>
                <th scope="col">Permission</th>
                {roles.map((role) => (
                  <th key={role} scope="col">
                    {roleLabels[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr
                  key={row.permission}
                  className={row.permission === 'rewards.adjust' ? 'is-flagged' : undefined}
                >
                  <th scope="row">
                    <code>{row.permission}</code>
                    <span className="cell-sub">
                      {row.action.replace(/^./, (c) => c.toUpperCase())}
                    </span>
                  </th>
                  {roles.map((role) => (
                    <td key={role} className={row.byRole[role] ? 'yes' : 'no'}>
                      {row.byRole[role] ? 'Yes' : 'No'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card
        title="Nobody here can adjust rewards"
        eyebrow="rewards.adjust"
        id="rewards"
        aside={
          <Chip tone="strong">
            {rewardHolders.length === 0
              ? 'Held by no human role'
              : `Held by ${rewardHolders.join(', ')}`}
          </Chip>
        }
      >
        <p>
          <code>rewards.adjust</code> is held by the service role alone. No editor, moderator,
          partner admin or club admin has it, so this console has no control for changing a reward
          balance. Balances belong to the rewards provider, and a person editing one would break its
          audit trail.
        </p>
        <ActionForm
          action={attemptRewardAdjustmentAction}
          className="row"
          style={{ marginTop: 'var(--s-lg)' }}
        >
          <SubmitButton>Run the refusal check</SubmitButton>
          <p className="hint" style={{ margin: 0 }}>
            Asks the server to adjust a demo balance as you. It is refused, and the refusal is
            written to the audit log.
          </p>
        </ActionForm>
      </Card>
    </div>
  );
}
