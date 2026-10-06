import { addMemberAction, changeOwnPasswordAction, changeRoleAction, removeMemberAction, resetPasswordAction } from '@/app/admin/team-actions';
import { ActionForm } from '@/components/admin/AdminForms';
import { Select, TextField, fieldStyles } from '@/components/forms/fields';
import { requireAdmin } from '@/lib/auth/admin';
import { listTeam, ROLES } from '@/lib/auth/team';
import { formatMoment } from '@/lib/booking/dates';
import styles from '../../admin.module.css';

export default async function TeamPage() {
  const admin = await requireAdmin();
  const team = await listTeam();
  const isOwner = admin.role === 'owner';

  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow eyebrow-accent">Team</p>
          <h1>Management accounts</h1>
        </div>
      </header>

      <section className={`${styles.panel} ${styles.tableWrap}`} aria-labelledby="team-title">
        <h2 id="team-title">People ({team.length})</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Last signed in</th>
              {isOwner && (
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {team.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  {u.id === admin.id && <span className={styles.origin}> · you</span>}
                  <div className={styles.small}>{u.email}</div>
                </td>
                <td>
                  {isOwner ? (
                    <ActionForm action={changeRoleAction.bind(null, u.id)} submit="Set role" variant="outline">
                      <label className="visually-hidden" htmlFor={`role-${u.id}`}>
                        Role for {u.name}
                      </label>
                      <select id={`role-${u.id}`} name="role" defaultValue={u.role} className={`${fieldStyles.input} ${fieldStyles.select}`}>
                        {ROLES.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </ActionForm>
                  ) : (
                    <span className={styles.badge}>{u.role}</span>
                  )}
                </td>
                <td className={styles.small}>{u.lastLoginAt ? formatMoment(u.lastLoginAt) : 'Never'}</td>
                {isOwner && (
                  <td>
                    <div className={styles.toolbar}>
                      <ActionForm action={resetPasswordAction.bind(null, u.id)} submit="Reset password" variant="outline" />
                      {u.id !== admin.id && <ActionForm action={removeMemberAction.bind(null, u.id)} submit="Remove" variant="outline" />}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <ul role="list" className={styles.small} style={{ display: 'grid', gap: 4 }}>
          {ROLES.map((r) => (
            <li key={r.key}>
              <strong>{r.label}</strong>: {r.detail}
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.grid2}>
        {isOwner && (
          <section className={styles.panel} aria-labelledby="add-title">
            <h2 id="add-title">Add someone</h2>
            <ActionForm action={addMemberAction} submit="Create account" className={styles.stack} resetOnSuccess>
              <TextField name="name" label="Name" autoComplete="off" />
              <TextField name="email" label="Email" type="email" autoComplete="off" />
              <Select name="role" label="Role" options={ROLES} defaultValue="manager" />
            </ActionForm>
            <p className={styles.small}>A temporary password is shown once. They sign in with it and change it under “Your password”.</p>
          </section>
        )}

        <section className={styles.panel} aria-labelledby="password-title">
          <h2 id="password-title">Your password</h2>
          <ActionForm action={changeOwnPasswordAction} submit="Change password" className={styles.stack} resetOnSuccess>
            <TextField name="current" label="Current password" type="password" autoComplete="current-password" />
            <TextField name="next" label="New password" type="password" autoComplete="new-password" minLength={12} hint="At least 12 characters." />
            <TextField name="confirm" label="New password again" type="password" autoComplete="new-password" minLength={12} />
          </ActionForm>
        </section>
      </div>
    </>
  );
}
