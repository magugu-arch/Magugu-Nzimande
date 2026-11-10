import {
  AUDIENCES,
  can,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_COPY,
} from '@kc-one/contracts';
import { DemoBanner, first, Notice, PageHead } from '@/components/ui';
import { requirePermission } from '@/lib/dal';
import { readAdminConfig } from '@/lib/env';
import { listCampaigns } from '@/lib/store';
import { cancelCampaignAction, createCampaignAction, scheduleCampaignAction } from '../../actions';

const AUDIENCE_COPY = {
  opted_in_all: 'Everyone who opted in to this category',
  opted_in_members: 'Verified members who opted in',
  opted_in_ticket_holders: 'Ticket holders for one fixture who opted in',
} as const;

export default async function Notifications({ searchParams }: PageProps<'/notifications'>) {
  const actor = await requirePermission('notifications.draft');
  const sp = await searchParams;
  const config = readAdminConfig();
  const campaigns = listCampaigns(actor);
  const canSchedule = can(actor.role, 'notifications.schedule');
  return (
    <>
      <PageHead eyebrow="Notifications" lead="Say it once," accent="say it right." />
      <Notice notice={first(sp.notice)} tone={first(sp.tone)} />
      <DemoBanner>
        Push delivery is{' '}
        {config.capabilities.notifications === 'live' ? 'connected' : 'not connected'}. Campaigns go
        only to supporters who opted in to the category, and deep links must be on the app’s
        allow-list.
      </DemoBanner>

      <form action={createCampaignAction} className="card stack" aria-label="New campaign">
        <h2>New campaign draft</h2>
        <label>
          Category
          <select name="category" defaultValue="matchday">
            {NOTIFICATION_CATEGORIES.filter((c) => c !== 'account').map((c) => (
              <option key={c} value={c}>
                {NOTIFICATION_CATEGORY_COPY[c].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Title (65 characters)
          <input name="title" required maxLength={65} />
        </label>
        <label>
          Message (178 characters)
          <textarea name="body" required maxLength={178} rows={3} />
        </label>
        <label>
          Opens (app path, optional)
          <input name="deepLink" placeholder="/match" pattern="^/[A-Za-z0-9/_-]*$" />
        </label>
        <label>
          Audience
          <select name="audience" defaultValue="opted_in_all">
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {AUDIENCE_COPY[a]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fixture id (ticket-holder campaigns only)
          <input name="fixtureId" />
        </label>
        <div className="row">
          <button className="primary" type="submit">
            Save draft
          </button>
        </div>
      </form>

      <section className="grid" style={{ gridTemplateColumns: '1fr' }} aria-label="Campaigns">
        {campaigns.length === 0 ? <div className="card muted">No campaigns yet.</div> : null}
        {campaigns.map((c) => (
          <article key={c.id} className="card" style={{ display: 'grid', gap: 12 }}>
            <div className="row">
              <span className={c.status === 'scheduled' ? 'tag warn' : 'tag'}>{c.status}</span>
              <span className="tag demo">Demo</span>
              <span className="micro">
                {NOTIFICATION_CATEGORY_COPY[c.category].label} · {AUDIENCE_COPY[c.audience]}
              </span>
            </div>
            <div className="preview" aria-label="Preview">
              <div className="micro">KC One · now</div>
              <strong>{c.title}</strong>
              <div className="muted">{c.body}</div>
            </div>
            {c.scheduledFor ? (
              <div className="micro">
                Scheduled for {new Date(c.scheduledFor).toLocaleString('en-ZA')}
              </div>
            ) : null}
            {c.status === 'draft' && canSchedule ? (
              <form action={scheduleCampaignAction} className="stack">
                <input type="hidden" name="id" value={c.id} />
                <label>
                  Send at (SAST)
                  <input type="datetime-local" name="when" required />
                </label>
                <label className="check">
                  <input type="checkbox" name="confirm" />
                  <span>I have checked the audience, wording and timing.</span>
                </label>
                <div className="row">
                  <button className="primary" type="submit">
                    Schedule
                  </button>
                </div>
              </form>
            ) : null}
            {c.status !== 'cancelled' ? (
              <form action={cancelCampaignAction}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit">Cancel</button>
              </form>
            ) : null}
          </article>
        ))}
      </section>
    </>
  );
}
