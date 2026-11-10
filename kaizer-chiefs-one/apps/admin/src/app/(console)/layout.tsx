import { can, ROLE_COPY, type Permission } from '@kc-one/contracts';
import { Nav } from '@/components/Nav';
import { requireSession } from '@/lib/dal';
import { signOut } from '../actions';

const NAV: { href: string; label: string; needs: Permission }[] = [
  { href: '/', label: 'Dashboard', needs: 'ops.read' },
  { href: '/content', label: 'Content', needs: 'content.read' },
  { href: '/moderation', label: 'Fan Moments', needs: 'moderation.read' },
  { href: '/notifications', label: 'Notifications', needs: 'notifications.draft' },
  { href: '/audit', label: 'Audit log', needs: 'audit.read' },
  { href: '/roles', label: 'Staff roles', needs: 'roles.manage' },
];

export default async function ConsoleLayout({ children }: LayoutProps<'/'>) {
  const session = await requireSession();
  // Hiding links is convenience only; every page and action checks again.
  const items = NAV.filter((n) => can(session.role, n.needs));
  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <div className="wordmark">KAIZER CHIEFS</div>
          <div className="micro" style={{ marginTop: 4 }}>
            One App · Staff console <span className="tag demo">Demo</span>
          </div>
        </div>
        <Nav items={items} />
        <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
          <div>
            <strong>{session.name}</strong>
            <div className="micro">{ROLE_COPY[session.role].label}</div>
          </div>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
