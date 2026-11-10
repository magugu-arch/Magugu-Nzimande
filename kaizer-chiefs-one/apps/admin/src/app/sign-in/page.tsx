import { ROLE_COPY } from '@kc-one/contracts';
import { first, Notice, PageHead } from '@/components/ui';
import { readAdminConfig } from '@/lib/env';
import { DEMO_STAFF } from '@/lib/store';
import { signInDemo } from '../actions';

export default async function SignIn({ searchParams }: PageProps<'/sign-in'>) {
  const sp = await searchParams;
  const config = readAdminConfig();
  return (
    <main className="main" style={{ maxWidth: 640, margin: '0 auto' }}>
      <PageHead eyebrow="KC One · Staff console · Concept" lead="Club staff," accent="sign in." />
      <Notice notice={first(sp.notice)} tone={first(sp.tone)} />
      {config.demoSignIn ? (
        <form action={signInDemo} className="card stack">
          <div className="banner">
            <span className="tag demo">Demo</span>
            <span>
              Choose a role to try the console. In production this is replaced by the club’s
              identity provider, and roles come from the admin_users table.
            </span>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            <legend className="micro" style={{ marginBottom: 8 }}>
              Demo role
            </legend>
            {DEMO_STAFF.map((s, i) => (
              <label key={s.id} className="check">
                <input type="radio" name="staff" value={s.id} defaultChecked={i === 0} />
                <span>
                  <strong>{ROLE_COPY[s.role].label}</strong>
                  <br />
                  <span className="muted">{ROLE_COPY[s.role].summary}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <button className="primary" type="submit">
            Sign in →
          </button>
        </form>
      ) : (
        <div className="card">Sign-in is provided by the club’s identity provider.</div>
      )}
      <p className="micro">Not an official Kaizer Chiefs system. Concept build for review.</p>
    </main>
  );
}
