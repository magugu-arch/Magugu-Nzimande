import type { Metadata } from 'next';
import {
  cancelNotificationAction,
  composeNotificationAction,
  sendTestAction,
} from '@/actions/notifications';
import { ActionForm, SubmitButton } from '@/components/action-form';
import {
  Card,
  Chip,
  DemoTag,
  Denied,
  Empty,
  Field,
  PageHeader,
  TableWrap,
  type Tone,
} from '@/components/ui';
import { formatDateTime, pushCategoryLabels, pushStatusLabels } from '@/lib/format';
import { getStore } from '@/lib/instance';
import { FREQUENCY_CAPS, PUSH_LIMITS } from '@/lib/notification-rules';
import { mayAct } from '@/lib/rbac';
import { requireActor } from '@/lib/session';
import { DAY, utcToZonedInput } from '@/lib/time';
import type { PushStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Notifications' };

const statusTone: Record<PushStatus, Tone> = {
  scheduled: 'warn',
  sent: 'good',
  cancelled: 'neutral',
};

export default async function NotificationsPage() {
  const actor = await requireActor();
  if (!mayAct(actor.role, 'notifications.schedule')) {
    return <Denied actor={actor} permission="notifications.schedule" section="Notifications" />;
  }
  const store = getStore();
  const segments = store.listSegments();
  const segmentName = new Map(segments.map((segment) => [segment.id, segment.label]));
  const pushes = store.listNotifications().sort((a, b) => b.sendAt.localeCompare(a.sendAt));
  const tests = store.listTests();
  const marketing = FREQUENCY_CAPS.marketing;
  const service = FREQUENCY_CAPS.service;
  const defaultSend = utcToZonedInput(new Date(store.now().getTime() + DAY).toISOString());

  return (
    <div className="stack">
      <PageHeader eyebrow="Notifications" title="Push notifications">
        Write a push in English and Welsh, choose who gets it and when, and send a test first.
        Marketing and service messages are kept apart, and both are frequency-capped.
      </PageHeader>

      <div className="split">
        <Card title="Compose" id="compose">
          <ActionForm action={composeNotificationAction} className="form" resetOnSuccess>
            <div className="pair">
              <Field label="Title" lang="EN" htmlFor="titleEn">
                <input
                  id="titleEn"
                  name="titleEn"
                  type="text"
                  required
                  maxLength={PUSH_LIMITS.title}
                />
              </Field>
              <Field label="Title" lang="CY" htmlFor="titleCy">
                <input
                  id="titleCy"
                  name="titleCy"
                  type="text"
                  lang="cy"
                  maxLength={PUSH_LIMITS.title}
                />
              </Field>
            </div>
            <div className="pair">
              <Field label="Message" lang="EN" htmlFor="bodyEn">
                <textarea
                  id="bodyEn"
                  name="bodyEn"
                  rows={3}
                  required
                  maxLength={PUSH_LIMITS.body}
                />
              </Field>
              <Field
                label="Message"
                lang="CY"
                htmlFor="bodyCy"
                hint="Without Welsh, Welsh-language devices get the English."
              >
                <textarea
                  id="bodyCy"
                  name="bodyCy"
                  rows={3}
                  lang="cy"
                  maxLength={PUSH_LIMITS.body}
                  aria-describedby="bodyCy-hint"
                />
              </Field>
            </div>

            <fieldset>
              <legend>Category</legend>
              <div className="choices">
                <label className="choice">
                  <input type="radio" name="category" value="service" defaultChecked />
                  <span>
                    Service message
                    <small>
                      About something the supporter already holds or follows: a fixture change, a
                      ticket, safety. Reaches everyone in the segment with push on. Never
                      promotional. Cap: {service.max} per segment in {service.window}.
                    </small>
                  </span>
                </label>
                <label className="choice">
                  <input type="radio" name="category" value="marketing" />
                  <span>
                    Marketing
                    <small>
                      Offers and promotion. Reaches only people who gave marketing consent, which is
                      separate from service messages and off by default. Cap: {marketing.max} per
                      segment in {marketing.window}.
                    </small>
                  </span>
                </label>
              </div>
            </fieldset>

            <div className="pair">
              <Field label="Segment" htmlFor="segment">
                <select id="segment" name="segment" defaultValue={segments[0]?.id}>
                  {segments.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Send time (UK time)" htmlFor="sendAt">
                <input id="sendAt" name="sendAt" type="datetime-local" defaultValue={defaultSend} />
              </Field>
            </div>

            <div className="row">
              <SubmitButton variant="primary" name="intent" value="schedule">
                Schedule
              </SubmitButton>
              <SubmitButton name="intent" value="test">
                Send test only
              </SubmitButton>
            </div>
            <p className="hint">
              “Send test only” delivers to the test device and schedules nothing. No supporter
              receives it and it does not count towards a cap.
            </p>
          </ActionForm>
        </Card>

        <Card title="Segments" eyebrow="Who can be reached" id="segments" aside={<DemoTag />}>
          <TableWrap label="Segments and consent">
            <table>
              <caption>
                DEMO figures, not club data. Marketing reaches the consent column only.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Segment</th>
                  <th scope="col" className="num">
                    Push on
                  </th>
                  <th scope="col" className="num">
                    Marketing consent
                  </th>
                  <th scope="col">Marketing cap</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment) => {
                  const usage = store.capUsage(segment.id, 'marketing');
                  return (
                    <tr key={segment.id}>
                      <th scope="row">
                        {segment.label}
                        <span className="cell-sub">{segment.description}</span>
                      </th>
                      <td className="num">{segment.pushEnabled}</td>
                      <td className="num">{segment.marketingConsent}</td>
                      <td>
                        <Chip tone={usage.used >= usage.max ? 'strong' : 'neutral'}>
                          {usage.used} of {usage.max} used
                        </Chip>
                        <span className="cell-sub">within {usage.window} of now</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>

      <Card title="Scheduled and sent" id="pushes" aside={<DemoTag />}>
        <TableWrap label="Scheduled and sent notifications">
          <table>
            <thead>
              <tr>
                <th scope="col">Notification</th>
                <th scope="col">Category</th>
                <th scope="col">Segment</th>
                <th scope="col" className="num">
                  Reaches
                </th>
                <th scope="col">Send time</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pushes.map((push) => (
                <tr key={push.id}>
                  <th scope="row">
                    {push.title.en}
                    <span className="cell-sub">{push.body.en}</span>
                    <span className="cell-sub" lang={push.title.cy ? 'cy' : undefined}>
                      {push.title.cy ? `Cymraeg: ${push.title.cy}` : 'No Welsh: English is sent'}
                    </span>
                  </th>
                  <td>
                    {pushCategoryLabels[push.category]}
                    <span className="cell-sub">
                      {push.category === 'marketing'
                        ? 'Marketing consent only'
                        : 'Everyone with push on'}
                    </span>
                  </td>
                  <td>{segmentName.get(push.segment)}</td>
                  <td className="num">{push.recipients}</td>
                  <td>
                    {formatDateTime(push.sendAt)}
                    <span className="cell-sub">by {push.createdBy}</span>
                  </td>
                  <td>
                    <Chip tone={statusTone[push.status]}>{pushStatusLabels[push.status]}</Chip>
                  </td>
                  <td className="actions">
                    <div className="row">
                      <ActionForm action={sendTestAction}>
                        <input type="hidden" name="id" value={push.id} />
                        <SubmitButton aria-label={`Send test of ${push.title.en}`}>
                          Send test
                        </SubmitButton>
                      </ActionForm>
                      {push.status === 'scheduled' ? (
                        <ActionForm action={cancelNotificationAction}>
                          <input type="hidden" name="id" value={push.id} />
                          <SubmitButton variant="quiet" aria-label={`Cancel ${push.title.en}`}>
                            Cancel
                          </SubmitButton>
                        </ActionForm>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card title="Test deliveries" eyebrow="Simulated" id="tests" aside={<DemoTag />}>
        {tests.length === 0 ? (
          <Empty>
            No test has been sent yet. Use “Send test” to see the simulated delivery here.
          </Empty>
        ) : (
          <TableWrap label="Test deliveries">
            <table>
              <thead>
                <tr>
                  <th scope="col">Delivered</th>
                  <th scope="col">Device</th>
                  <th scope="col">English view</th>
                  <th scope="col">Welsh view</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => (
                  <tr key={test.id}>
                    <th scope="row">
                      {formatDateTime(test.at)}
                      <span className="cell-sub">by {test.sentBy}</span>
                    </th>
                    <td>
                      {test.device}
                      <span className="cell-sub">{test.provider}</span>
                    </td>
                    <td>
                      {test.en.title}
                      <span className="cell-sub">{test.en.body}</span>
                    </td>
                    <td lang={test.cy.fallback ? 'en' : 'cy'}>
                      {test.cy.title}
                      <span className="cell-sub">{test.cy.body}</span>
                      {test.cy.fallback ? (
                        <span className="fallback">Fell back to English</span>
                      ) : null}
                    </td>
                    <td>
                      <Chip tone="good">Delivered (simulated)</Chip>
                      <span className="cell-sub">
                        {pushCategoryLabels[test.category]} · no supporter received it
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
