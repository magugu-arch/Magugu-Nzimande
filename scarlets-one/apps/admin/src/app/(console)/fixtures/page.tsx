import type { Metadata } from 'next';
import { formatVenueTime, type FixtureStatus } from '@scarlets/domain';
import {
  clearFixtureNoticeAction,
  setFixtureNoticeAction,
  setFixtureVisibilityAction,
} from '@/actions/fixtures';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { Chip, DemoTag, Denied, Field, PageHeader } from '@/components/ui';
import { NOTICE_LIMIT } from '@/lib/fixture-rules';
import { formatDateTime, noticeKindLabels } from '@/lib/format';
import { getStore } from '@/lib/instance';
import { providerFixtures } from '@/lib/provider-view';
import { mayAct } from '@/lib/rbac';
import { requireActor } from '@/lib/session';
import { fixtureNoticeKinds } from '@/lib/types';

export const metadata: Metadata = { title: 'Fixtures' };

const statusLabels: Record<FixtureStatus, string> = {
  scheduled: 'Scheduled',
  live: 'Live',
  half_time: 'Half-time',
  full_time: 'Full time',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

const squadLabels = { first_team: 'First team', women: 'Women', academy: 'Academy' } as const;

export default async function FixturesPage() {
  const actor = await requireActor();
  if (!mayAct(actor.role, 'fixtures.override')) {
    return <Denied actor={actor} permission="fixtures.override" section="Fixtures" />;
  }
  const store = getStore();
  const records = store
    .listFixtures()
    .sort((a, b) => a.fixture.kickoffUtc.localeCompare(b.fixture.kickoffUtc));
  const provider = await providerFixtures(() => store.now());

  return (
    <div className="stack">
      <PageHeader eyebrow="Fixtures" title="Visibility and notices">
        Hide a fixture from supporters, or add an editorial notice such as “Postponed”. The fixture
        list itself comes from the fixtures feed.
      </PageHeader>

      <p className="note">
        <strong>Scores cannot be entered here.</strong> A score and a match status come only from
        the match-data provider ({provider.meta.source}, on its mock). This screen has no score
        field, and the server refuses a request that tries to send one or a notice that contains
        one.
      </p>

      <ul className="items" aria-label="Fixtures">
        {records.map(({ fixture, visible, notice, updatedAt, updatedBy }) => {
          const when = formatVenueTime(fixture.kickoffUtc, fixture.venue.timeZone, 'en');
          const feed = provider.byId.get(fixture.id);
          const name = `${fixture.home.name} v ${fixture.away.name}`;
          return (
            <li key={fixture.id} className="item item--plain">
              <div className="item__body">
                <div className="row">
                  <Chip tone={visible ? 'good' : 'strong'}>
                    {visible ? 'Visible to supporters' : 'Hidden from supporters'}
                  </Chip>
                  {notice ? <Chip tone="warn">Notice: {noticeKindLabels[notice.kind]}</Chip> : null}
                  <DemoTag />
                </div>
                <h2>{name}</h2>
                <dl className="facts">
                  <dt>Kick-off</dt>
                  <dd>
                    {when.longDate}, {when.time} {when.zone}
                    {fixture.kickoffProvisional ? ' (provisional)' : ''}
                  </dd>
                  <dt>Venue</dt>
                  <dd>{[fixture.venue.name, fixture.venue.city].filter(Boolean).join(', ')}</dd>
                  <dt>Competition</dt>
                  <dd>
                    {fixture.competition.en} · {squadLabels[fixture.squad]}
                  </dd>
                  <dt>From the provider</dt>
                  <dd>
                    {feed
                      ? `${statusLabels[feed.status]}${feed.score ? `, ${fixture.home.shortName} ${feed.score.home} · ${fixture.away.shortName} ${feed.score.away}` : ', no score yet'}`
                      : 'No longer listed by the feed'}
                    <span className="cell-sub">Read-only. DEMO feed, not a real result.</span>
                  </dd>
                  {fixture.note ? (
                    <>
                      <dt>Feed note</dt>
                      <dd>{fixture.note.en}</dd>
                    </>
                  ) : null}
                  {notice ? (
                    <>
                      <dt>Your notice</dt>
                      <dd>
                        <span lang="en">{notice.text.en}</span>
                        <span className="cell-sub" lang={notice.text.cy ? 'cy' : undefined}>
                          {notice.text.cy ?? 'No Welsh: Welsh readers see the English notice.'}
                        </span>
                      </dd>
                    </>
                  ) : null}
                  {updatedAt ? (
                    <>
                      <dt>Last change</dt>
                      <dd>
                        {updatedBy}, {formatDateTime(updatedAt)}
                      </dd>
                    </>
                  ) : null}
                </dl>
              </div>

              <div className="item__actions">
                <ActionForm action={setFixtureVisibilityAction}>
                  <input type="hidden" name="id" value={fixture.id} />
                  <input type="hidden" name="visible" value={visible ? 'no' : 'yes'} />
                  <SubmitButton aria-label={`${visible ? 'Hide' : 'Show'} ${name}`}>
                    {visible ? 'Hide from supporters' : 'Show to supporters'}
                  </SubmitButton>
                </ActionForm>

                <details open={notice !== null}>
                  <summary>{notice ? 'Edit notice' : 'Add a notice'}</summary>
                  <ActionForm
                    key={updatedAt ?? 'new'}
                    action={setFixtureNoticeAction}
                    className="form"
                  >
                    <input type="hidden" name="id" value={fixture.id} />
                    <Field label="Notice type" htmlFor={`kind-${fixture.id}`}>
                      <select
                        id={`kind-${fixture.id}`}
                        name="kind"
                        defaultValue={notice?.kind ?? 'postponed'}
                      >
                        {fixtureNoticeKinds.map((kind) => (
                          <option key={kind} value={kind}>
                            {noticeKindLabels[kind]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label="Note"
                      lang="EN"
                      htmlFor={`noteEn-${fixture.id}`}
                      hint="No scores or results. Write dates in words."
                    >
                      <textarea
                        id={`noteEn-${fixture.id}`}
                        name="noteEn"
                        rows={2}
                        maxLength={NOTICE_LIMIT}
                        defaultValue={notice?.text.en ?? ''}
                        aria-describedby={`noteEn-${fixture.id}-hint`}
                      />
                    </Field>
                    <Field label="Note" lang="CY" htmlFor={`noteCy-${fixture.id}`}>
                      <textarea
                        id={`noteCy-${fixture.id}`}
                        name="noteCy"
                        rows={2}
                        lang="cy"
                        maxLength={NOTICE_LIMIT}
                        defaultValue={notice?.text.cy ?? ''}
                      />
                    </Field>
                    <div className="row">
                      <SubmitButton variant="primary" aria-label={`Save notice for ${name}`}>
                        Save notice
                      </SubmitButton>
                    </div>
                  </ActionForm>
                  {notice ? (
                    <ActionForm
                      action={clearFixtureNoticeAction}
                      style={{ marginTop: 'var(--s-sm)' }}
                    >
                      <input type="hidden" name="id" value={fixture.id} />
                      <SubmitButton variant="quiet" aria-label={`Remove notice from ${name}`}>
                        Remove notice
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                </details>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
