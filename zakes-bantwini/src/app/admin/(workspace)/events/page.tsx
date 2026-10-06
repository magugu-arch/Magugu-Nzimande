import { ActionForm } from '@/components/admin/AdminForms';
import { Checkbox, TextArea, TextField, fieldStyles } from '@/components/forms/fields';
import { requireAdmin } from '@/lib/auth/admin';
import { formatDay, todayIso } from '@/lib/booking/dates';
import type { EventRecord } from '@/lib/booking/types';
import { getStore } from '@/lib/store';
import { deleteEventAction, saveEventAction } from '../../actions';
import styles from '../../admin.module.css';

function EventFields({ e }: { e?: EventRecord }) {
  return (
    <>
      <TextField name="title" label="Title" defaultValue={e?.title} />
      <div className={fieldStyles.row3}>
        <TextField name="date" label="Date" type="date" defaultValue={e?.date} />
        <TextField name="startTime" label="Start time" type="time" optional defaultValue={e?.startTime ?? ''} />
        <TextField name="ticketUrl" label="Official ticket link" type="url" optional defaultValue={e?.ticketUrl ?? ''} />
      </div>
      <div className={fieldStyles.row3}>
        <TextField name="venue" label="Venue" defaultValue={e?.venue} />
        <TextField name="city" label="City" defaultValue={e?.city} />
        <TextField name="country" label="Country" defaultValue={e?.country ?? 'South Africa'} />
      </div>
      <TextArea name="description" label="Description" optional rows={2} defaultValue={e?.description ?? ''} />
      <Checkbox name="published" label="Published on /live (only verified details)" defaultChecked={e?.published ?? false} />
    </>
  );
}

/** Public shows — the only source of dates on /live and the homepage. Nothing is seeded. */
export default async function EventsPage() {
  const admin = await requireAdmin();
  const events = await getStore().list('events', { where: { kind: 'public' }, orderBy: { field: 'date', dir: 'desc' } });
  const today = todayIso();
  const readOnly = admin.role === 'viewer';

  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow eyebrow-accent">Public events</p>
          <h1>Live dates</h1>
        </div>
        <p className={styles.small}>Only published, upcoming shows appear on the site.</p>
      </header>

      {!readOnly && (
        <section className={styles.panel} aria-labelledby="new-title">
          <h2 id="new-title">Add a show</h2>
          <ActionForm action={saveEventAction.bind(null, null)} submit="Save show" className={styles.panel} resetOnSuccess>
            <EventFields />
          </ActionForm>
        </section>
      )}

      {events.length === 0 ? (
        <section className={styles.panel}>
          <p>No public shows yet. The live page shows a designed “no dates announced” state until one is published.</p>
        </section>
      ) : (
        events.map((e) => (
          <section key={e.id} className={styles.panel} aria-label={e.title}>
            <h2>
              {formatDay(e.date)} · {e.title} {e.published ? (e.date >= today ? '· live on site' : '· past') : '· draft'}
            </h2>
            {readOnly ? (
              <p>
                {e.venue}, {e.city}
              </p>
            ) : (
              <>
                <ActionForm action={saveEventAction.bind(null, e.id)} submit="Update" className={styles.panel} variant="outline">
                  <EventFields e={e} />
                </ActionForm>
                <form action={deleteEventAction.bind(null, e.id)}>
                  <button type="submit" className={styles.remove} style={{ padding: '0 14px' }}>
                    Delete show
                  </button>
                </form>
              </>
            )}
          </section>
        ))
      )}
    </>
  );
}
