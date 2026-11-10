import { ROLE_COPY, ROLE_PERMISSIONS, ROLES } from '@kc-one/contracts';
import { first, Notice, PageHead } from '@/components/ui';
import { requirePermission } from '@/lib/dal';
import { listStaff } from '@/lib/store';
import { setRoleAction } from '../../actions';

export default async function Roles({ searchParams }: PageProps<'/roles'>) {
  const actor = await requirePermission('roles.manage');
  const sp = await searchParams;
  const staff = listStaff(actor);
  return (
    <>
      <PageHead eyebrow="Staff roles" lead="Least privilege," accent="by default." />
      <Notice notice={first(sp.notice)} tone={first(sp.tone)} />
      <section className="card">
        <table>
          <thead>
            <tr>
              <th scope="col">Staff member</th>
              <th scope="col">Role</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.name} <span className="tag demo">Demo</span>
                </td>
                <td>{ROLE_COPY[s.role].label}</td>
                <td>
                  {s.id === actor.sub ? (
                    <span className="micro">You can’t change your own role</span>
                  ) : (
                    <form action={setRoleAction} className="row">
                      <input type="hidden" name="id" value={s.id} />
                      <select name="role" defaultValue={s.role} aria-label={`Role for ${s.name}`}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_COPY[r].label}
                          </option>
                        ))}
                      </select>
                      <button type="submit">Save</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2 style={{ marginBottom: 12 }}>What each role can do</h2>
        <table>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r}>
                <th scope="row" style={{ width: 200 }}>
                  {ROLE_COPY[r].label}
                </th>
                <td className="muted">{[...ROLE_PERMISSIONS[r]].join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
