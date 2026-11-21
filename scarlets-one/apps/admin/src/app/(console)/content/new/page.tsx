import type { Metadata } from 'next';
import Link from 'next/link';
import { contentCategory } from '@scarlets/domain';
import { createContentAction } from '@/actions/content';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { ContentFields } from '@/components/content-fields';
import { Card, Denied, Field, PageHeader } from '@/components/ui';
import { categoryLabels } from '@/lib/format';
import { mediaChoices } from '@/lib/media';
import { mayAct } from '@/lib/rbac';
import { requireActor } from '@/lib/session';

export const metadata: Metadata = { title: 'New draft' };

export default async function NewContentPage() {
  const actor = await requireActor();
  if (!mayAct(actor.role, 'content.write')) {
    return <Denied actor={actor} permission="content.write" section="New draft" />;
  }
  return (
    <div className="stack">
      <PageHeader eyebrow="Content" title="New draft">
        A draft is not visible to supporters. When it is ready, a club admin previews it in both
        languages and publishes or schedules it.
      </PageHeader>
      <Card title="Write the draft" id="new-draft">
        <ActionForm action={createContentAction} className="form">
          <div className="pair">
            <Field
              label="Type"
              htmlFor="kind"
              hint="Match reports and video or audio links come from the club’s own systems."
            >
              <select id="kind" name="kind" defaultValue="feature" aria-describedby="kind-hint">
                <option value="feature">Feature</option>
                <option value="news">News</option>
              </select>
            </Field>
            <Field label="Category" htmlFor="category">
              <select id="category" name="category" defaultValue="club">
                {contentCategory.options.map((option) => (
                  <option key={option} value={option}>
                    {categoryLabels[option]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            label="Image"
            htmlFor="mediaId"
            hint="Concept images only. Each needs club media approval before real use."
          >
            <select
              id="mediaId"
              name="mediaId"
              defaultValue="red-wall-hero"
              aria-describedby="mediaId-hint"
            >
              {mediaChoices().map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>
          </Field>
          <ContentFields canApproveWelsh={mayAct(actor.role, 'content.publish')} />
          <div className="row">
            <SubmitButton variant="primary">Save draft</SubmitButton>
            <Link className="btn btn--quiet" href="/content">
              Cancel
            </Link>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
