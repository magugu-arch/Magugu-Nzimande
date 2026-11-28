'use client';

import { useState } from 'react';
import { saveEventAction } from '@/app/admin/actions';
import { ActionForm, SubmitButton } from './forms';
import styles from './admin.module.css';

export type EventFormValues = {
  id?: string;
  title: string;
  slug: string;
  tag: string;
  summary: string;
  body: string;
  startsAt: string;
  endsAt: string;
  image: string;
  price: string;
  capacity: string;
  status: 'draft' | 'published' | 'cancelled';
};

const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export function EventForm({ values, images }: { values: EventFormValues; images: { slug: string; alt: string }[] }) {
  const [title, setTitle] = useState(values.title);
  const [slug, setSlug] = useState(values.slug);
  const [slugTouched, setSlugTouched] = useState(!!values.id);
  const shownSlug = slugTouched ? slug : slugify(title);

  return (
    <ActionForm action={saveEventAction}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className={`${styles.fields} ${styles.fields2}`}>
        <div className={`field ${styles.span2}`}>
          <label className="field-label" htmlFor="ev-title">
            Title
          </label>
          <input id="ev-title" name="title" className="input" maxLength={120} required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ev-slug">
            Web address
          </label>
          <input
            id="ev-slug"
            name="slug"
            className="input"
            maxLength={80}
            value={shownSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
          <span className="field-hint">sowetotowers.co.za/events/{shownSlug || '…'}</span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ev-tag">
            Tag
          </label>
          <input id="ev-tag" name="tag" className="input" maxLength={30} defaultValue={values.tag} placeholder="Launch, Heritage Day…" required />
        </div>
        <div className={`field ${styles.span2}`}>
          <label className="field-label" htmlFor="ev-summary">
            One-line summary
          </label>
          <input id="ev-summary" name="summary" className="input" maxLength={220} defaultValue={values.summary} required />
          <span className="field-hint">Shown on cards and in Google. About 150 characters works best.</span>
        </div>
        <div className={`field ${styles.span2}`}>
          <label className="field-label" htmlFor="ev-body">
            Description
          </label>
          <textarea id="ev-body" name="body" className="input" rows={7} maxLength={4000} defaultValue={values.body} required />
          <span className="field-hint">Leave a blank line between paragraphs.</span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ev-start">
            Starts (SAST)
          </label>
          <input id="ev-start" name="startsAt" type="datetime-local" className="input" defaultValue={values.startsAt} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ev-end">
            Ends (SAST)
          </label>
          <input id="ev-end" name="endsAt" type="datetime-local" className="input" defaultValue={values.endsAt} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ev-price">
            Ticket price in rand
          </label>
          <input id="ev-price" name="price" className="input" inputMode="numeric" defaultValue={values.price} placeholder="Empty = free with RSVP" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ev-capacity">
            Capacity
          </label>
          <input id="ev-capacity" name="capacity" type="number" min={1} max={20000} className="input" defaultValue={values.capacity} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ev-image">
            Image
          </label>
          <select id="ev-image" name="image" className="input" defaultValue={values.image}>
            {images.map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.slug.replace(/-/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ev-status">
            Status
          </label>
          <select id="ev-status" name="status" className="input" defaultValue={values.status}>
            <option value="draft">Draft: hidden from the website</option>
            <option value="published">Published</option>
            <option value="cancelled">Cancelled: shown as cancelled</option>
          </select>
        </div>
      </div>
      <div>
        <SubmitButton className="btn btn--primary" pendingLabel="Saving…">
          {values.id ? 'Save changes' : 'Create event'}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
