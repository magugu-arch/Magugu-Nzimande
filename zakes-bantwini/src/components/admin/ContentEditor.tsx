'use client';

import { startTransition, useActionState, type FormEvent, type ReactNode } from 'react';
import { FormAlert, Select, TextArea, TextField, fieldStyles } from '@/components/forms/fields';
import { Button } from '@/components/ui/Button';
import type { AdminState } from '@/app/admin/actions';
import type { FormValues } from '@/lib/cms/forms';
import type { ContentCollection } from '@/lib/cms/types';
import styles from '@/app/admin/admin.module.css';

type Option = { key: string; label: string };
export type EditorOptions = {
  media: Option[];
  albums: Option[];
  videos: Option[];
  stories: Option[];
  images: Option[];
  audio: Option[];
  documents: Option[];
  captions: Option[];
};

const APPROVAL: Option[] = [
  { key: 'approved', label: 'Approved' },
  { key: 'pending', label: 'Pending sign-off' },
  { key: 'placeholder', label: 'Placeholder' },
];

const ALBUM_KINDS: Option[] = [
  { key: 'album', label: 'Album' },
  { key: 'ep', label: 'EP' },
  { key: 'single', label: 'Single' },
  { key: 'compilation', label: 'Compilation' },
  { key: 'live', label: 'Live' },
];
const VIDEO_KINDS: Option[] = [
  { key: 'official', label: 'Official video' },
  { key: 'live', label: 'Live film' },
  { key: 'behind-the-scenes', label: 'Behind the scenes' },
  { key: 'film', label: 'Film' },
];
const CATEGORIES: Option[] = ['music', 'culture', 'live', 'people', 'studio', 'legacy'].map((k) => ({ key: k, label: k[0]!.toUpperCase() + k.slice(1) }));

const initial: AdminState = { ok: false, message: null };

/**
 * One editor for every collection. Fields are uncontrolled and the form is
 * submitted by hand (not via the `action` prop) so a rejected save keeps
 * everything the editor typed instead of React resetting the form.
 */
export function ContentEditor({
  collection,
  isNew,
  defaults,
  options,
  action,
  readOnly,
}: {
  collection: ContentCollection;
  isNew: boolean;
  defaults: FormValues;
  options: EditorOptions;
  action: (prev: AdminState, form: FormData) => Promise<AdminState>;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const err = (name: string) => state.fields?.[name];
  const d = (name: string) => {
    const v = defaults[name];
    return Array.isArray(v) ? v.join(', ') : (v ?? '');
  };
  const many = (name: string) => {
    const v = defaults[name];
    return Array.isArray(v) ? v : v ? [v] : [];
  };

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  const approval = (name = 'approval') => <Select name={name} label="Approval" options={APPROVAL} defaultValue={d(name)} error={err(name)} hint="Approved entries publish in launch mode; pending and placeholder entries do not." />;
  const slugField = (prefix: string) =>
    isNew ? (
      <TextField name="slug" label="Web address" optional defaultValue={d('slug')} error={err('slug')} hint={`${prefix}/… — lower-case words and hyphens. Left blank, it is made from the title. It cannot change later.`} />
    ) : null;

  let fields: ReactNode;
  switch (collection) {
    case 'albums':
      fields = (
        <>
          <Group title="Release">
            <TextField name="title" label="Title" defaultValue={d('title')} error={err('title')} />
            {slugField('/music')}
            <div className={fieldStyles.row3}>
              <Select name="kind" label="Type" options={ALBUM_KINDS} defaultValue={d('kind')} error={err('kind')} />
              <TextField name="year" label="Year" optional inputMode="numeric" defaultValue={d('year')} error={err('year')} />
              {approval()}
            </div>
            <TextArea name="description" label="Description" rows={4} defaultValue={d('description')} error={err('description')} />
          </Group>
          <Group title="Artwork">
            <div className={fieldStyles.row2}>
              <Select name="artworkSrc" label="Cover artwork" optional placeholder="None yet — use the typographic sleeve" options={options.images} defaultValue={d('artworkSrc')} error={err('artworkSrc')} hint="Upload approved cover art in the Asset library first." />
              <TextField name="artworkAlt" label="Cover description (alt text)" optional defaultValue={d('artworkAlt')} error={err('artworkAlt')} />
            </div>
            <Select name="mood" label="Mood image" options={options.media} defaultValue={d('mood')} error={err('mood')} hint="One of the 41 supplied photographs, set around the record." />
          </Group>
          <Group title="Tracks and credits">
            <TextArea
              name="tracks"
              label="Tracklist"
              optional
              rows={8}
              defaultValue={d('tracks')}
              error={err('tracks')}
              hint="One track per line: Title | 4:05 | audio link | featured artists | ISRC. Only the title is required. Audio links come from the Asset library."
              className={styles.mono}
            />
            <TextArea name="credits" label="Credits" optional rows={4} defaultValue={d('credits')} error={err('credits')} hint="One per line: Role: Name — e.g. Producer: …" className={styles.mono} />
          </Group>
          <Group title="Listen links">
            <StreamingFields d={d} err={err} />
          </Group>
          <Group title="Related">
            <CheckList name="relatedVideos" legend="Related videos" options={options.videos} selected={many('relatedVideos')} />
            <CheckList name="relatedStories" legend="Related journal stories" options={options.stories} selected={many('relatedStories')} />
            <TextArea name="editorNote" label="Note for editors (not public)" optional rows={2} defaultValue={d('editorNote')} />
          </Group>
        </>
      );
      break;
    case 'videos':
      fields = (
        <>
          <Group title="Video">
            <TextField name="title" label="Title" defaultValue={d('title')} error={err('title')} />
            {slugField('/videos')}
            <div className={fieldStyles.row3}>
              <Select name="kind" label="Type" options={VIDEO_KINDS} defaultValue={d('kind')} error={err('kind')} />
              <TextField name="publishedAt" label="Release date" type="date" optional defaultValue={d('publishedAt')} error={err('publishedAt')} />
              {approval()}
            </div>
            <TextArea name="description" label="Description" rows={3} defaultValue={d('description')} error={err('description')} />
            <div className={fieldStyles.row2}>
              <Select name="poster" label="Poster image" options={options.media} defaultValue={d('poster')} error={err('poster')} />
              <Select name="relatedAlbum" label="Related release" optional placeholder="None" options={options.albums} defaultValue={d('relatedAlbum')} error={err('relatedAlbum')} />
            </div>
          </Group>
          <Group title="Source">
            <Select
              name="sourceType"
              label="Where the video plays from"
              options={[
                { key: 'none', label: 'Not supplied yet — show the pending state' },
                { key: 'youtube', label: 'YouTube (privacy-enhanced embed)' },
                { key: 'file', label: 'A video file (MP4/WebM link)' },
              ]}
              placeholder="Choose…"
              defaultValue={d('sourceType')}
              error={err('sourceType') ?? err('source')}
            />
            <TextField name="youtube" label="YouTube link" optional defaultValue={d('youtube')} error={err('youtube')} hint="Any YouTube link or the 11-character id." />
            <TextField name="fileSrc" label="Video file link" optional defaultValue={d('fileSrc')} error={err('fileSrc')} hint="An https link to the MP4 on your video host (large files do not belong in the site)." />
            <TextArea
              name="captions"
              label="Captions"
              optional
              rows={3}
              defaultValue={d('captions')}
              error={err('captions')}
              className={styles.mono}
              hint={
                <>
                  For video files. One per line: Label | language code | caption file link. Upload .vtt files in the Asset library
                  {options.captions.length ? ` (${options.captions.length} available)` : ''}.
                </>
              }
            />
            <TextField name="duration" label="Length" optional placeholder="4:05" defaultValue={d('duration')} error={err('duration')} />
          </Group>
        </>
      );
      break;
    case 'stories':
      fields = (
        <>
          <Group title="Story">
            <TextField name="title" label="Headline" defaultValue={d('title')} error={err('title')} />
            {slugField('/journal')}
            <div className={fieldStyles.row3}>
              <Select name="category" label="Category" options={CATEGORIES} defaultValue={d('category')} error={err('category')} />
              <TextField name="publishedAt" label="Publish date" type="date" optional defaultValue={d('publishedAt')} error={err('publishedAt')} />
              {approval()}
            </div>
            <TextArea name="standfirst" label="Standfirst" rows={2} defaultValue={d('standfirst')} error={err('standfirst')} />
            <Select name="hero" label="Lead image" options={options.media} defaultValue={d('hero')} error={err('hero')} />
          </Group>
          <Group title="Body">
            <TextArea
              name="body"
              label="Text"
              rows={18}
              defaultValue={d('body')}
              error={err('body')}
              className={styles.mono}
              hint="Leave a blank line between paragraphs. ## starts a heading, > a pull statement, and [image IMG_6866 | caption] places one of the supplied photographs."
            />
          </Group>
        </>
      );
      break;
    case 'pillars':
      fields = (
        <Group title="Pillar">
          <div className={fieldStyles.row2}>
            <TextField name="title" label="Title" defaultValue={d('title')} error={err('title')} />
            <TextField name="kicker" label="Kicker" defaultValue={d('kicker')} error={err('kicker')} />
          </div>
          <TextArea name="summary" label="Summary" rows={2} defaultValue={d('summary')} error={err('summary')} />
          <TextArea name="body" label="Body" rows={8} defaultValue={d('body')} error={err('body')} hint="Leave a blank line between paragraphs." />
          <div className={fieldStyles.row3}>
            <Select name="media" label="Image" options={options.media} defaultValue={d('media')} error={err('media')} />
            <Select name="secondaryMedia" label="Second image" optional placeholder="None" options={options.media} defaultValue={d('secondaryMedia')} />
            {approval()}
          </div>
        </Group>
      );
      break;
    case 'pressKit':
      fields = (
        <>
          <Group title="Biography">
            <TextArea name="shortBio" label="Short biography" rows={3} defaultValue={d('shortBio')} error={err('shortBio')} />
            <TextArea name="longBio" label="Long biography" rows={10} defaultValue={d('longBio')} error={err('longBio')} hint="Leave a blank line between paragraphs. Facts here must come from management records." />
            {approval()}
          </Group>
          <Group title="Recognition">
            <TextArea name="awards" label="Awards" optional rows={5} defaultValue={d('awards')} error={err('awards')} className={styles.mono} hint="One per line: Year | Award | detail (optional). Only verified awards." />
            <TextArea name="quotes" label="Press quotes" optional rows={4} defaultValue={d('quotes')} error={err('quotes')} className={styles.mono} hint="One per line: Quote | Publication | link (optional). Only approved quotes." />
          </Group>
          <Group title="Performance">
            <TextArea name="formats" label="Performance formats" rows={4} defaultValue={d('formats')} error={err('formats')} className={styles.mono} hint="One per line: Format | what it involves." />
            <TextArea name="performanceNotes" label="Notes for promoters" rows={3} defaultValue={d('performanceNotes')} error={err('performanceNotes')} />
            <Select name="riderUrl" label="Technical rider (PDF)" optional placeholder="Not supplied — offered on request" options={options.documents} defaultValue={d('riderUrl')} error={err('riderUrl')} hint="Upload the approved rider in the Asset library first." />
          </Group>
          <Group title="Press photographs">
            <CheckList name="photos" legend="Photos offered for download" options={options.media} selected={many('photos')} error={err('photos')} columns />
          </Group>
        </>
      );
      break;
    case 'settings':
      fields = (
        <>
          <Group title="Streaming profiles">
            <StreamingFields d={d} err={err} />
            {approval('streamingApproval')}
          </Group>
          <Group title="Contact and social">
            <div className={fieldStyles.row2}>
              <TextField name="bookingEmail" label="Public bookings email" type="email" optional defaultValue={d('bookingEmail')} error={err('bookingEmail')} />
              <TextField name="pressEmail" label="Public press email" type="email" optional defaultValue={d('pressEmail')} error={err('pressEmail')} />
            </div>
            <TextArea name="social" label="Official social profiles" optional rows={5} defaultValue={d('social')} error={err('social')} className={styles.mono} hint="One per line: Label | https link — e.g. Instagram | https://…" />
          </Group>
          <Group title="Featured on the home page">
            <TextField name="featuredAlbums" label="Releases" optional defaultValue={d('featuredAlbums')} error={err('featuredAlbums')} hint={`In order, separated by commas. Available: ${options.albums.map((o) => o.key).join(', ')}`} />
            <TextField name="featuredVideos" label="Videos" optional defaultValue={d('featuredVideos')} error={err('featuredVideos')} hint={`Available: ${options.videos.map((o) => o.key).join(', ')}`} />
            <TextField name="featuredStories" label="Journal stories" optional defaultValue={d('featuredStories')} error={err('featuredStories')} hint={`Available: ${options.stories.map((o) => o.key).join(', ')}`} />
          </Group>
        </>
      );
      break;
  }

  return (
    <form onSubmit={submit} className={styles.editor} noValidate={false}>
      <fieldset disabled={readOnly || pending} className={styles.editorFields}>
        {fields}
      </fieldset>
      <div className={styles.editorBar}>
        {state.message && <FormAlert tone={state.ok ? 'success' : 'error'}>{state.message}</FormAlert>}
        {readOnly ? (
          <p className={styles.small}>Your role is read-only.</p>
        ) : (
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? 'Saving…' : isNew ? 'Create' : 'Save changes'}
          </Button>
        )}
      </div>
    </form>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.panel} aria-label={title}>
      <h2>{title}</h2>
      <div className={styles.stack}>{children}</div>
    </section>
  );
}

function StreamingFields({ d, err }: { d: (n: string) => string; err: (n: string) => string | undefined }) {
  return (
    <div className={fieldStyles.row2}>
      <TextField name="spotify" label="Spotify" type="url" optional defaultValue={d('spotify')} error={err('spotify')} />
      <TextField name="appleMusic" label="Apple Music" type="url" optional defaultValue={d('appleMusic')} error={err('appleMusic')} />
      <TextField name="youtube" label="YouTube" type="url" optional defaultValue={d('youtube')} error={err('youtube')} />
      <TextField name="deezer" label="Deezer" type="url" optional defaultValue={d('deezer')} error={err('deezer')} />
    </div>
  );
}

function CheckList({ name, legend, options, selected, error, columns }: { name: string; legend: string; options: Option[]; selected: string[]; error?: string; columns?: boolean }) {
  return (
    <fieldset className={fieldStyles.fieldset} aria-invalid={error ? true : undefined} aria-describedby={error ? `${name}-error` : undefined}>
      <legend className={fieldStyles.label}>{legend}</legend>
      {options.length === 0 ? (
        <p className={styles.small}>Nothing to choose from yet.</p>
      ) : (
        <div className={columns ? styles.checkColumns : styles.checkRow}>
          {options.map((o) => (
            <label key={o.key} className={styles.checkItem}>
              <input type="checkbox" name={name} value={o.key} defaultChecked={selected.includes(o.key)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
      {error && (
        <span id={`${name}-error`} className={fieldStyles.error}>
          {error}
        </span>
      )}
    </fieldset>
  );
}
