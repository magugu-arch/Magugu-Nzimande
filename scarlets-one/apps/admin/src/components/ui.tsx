import Image from 'next/image';
import type { ReactNode } from 'react';
import type { Permission } from '@scarlets/domain';
import { mediaFor } from '@/lib/media';
import { denialMessage, humanRolesWith, roleLabels } from '@/lib/rbac';
import type { Actor } from '@/lib/types';

export type Tone = 'neutral' | 'good' | 'warn' | 'strong' | 'gold';

/** A status in words. Tone adds colour, but the text always carries the meaning. */
export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}

/** Every piece of mock data carries this. */
export function DemoTag() {
  return (
    <span className="chip chip--gold" title="Mock data, not club data">
      DEMO
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children ? <p className="lede">{children}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function Card({
  title,
  eyebrow,
  aside,
  children,
  className,
  id,
}: {
  title?: string;
  eyebrow?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      className={['card', className].filter(Boolean).join(' ')}
      id={id}
      aria-labelledby={title ? headingId : undefined}
    >
      {title || eyebrow || aside ? (
        <div className="card__head">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? <h2 id={headingId}>{title}</h2> : null}
          </div>
          {aside ? <div className="card__aside">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** A table that can be scrolled sideways by keyboard when it is wider than the page. */
export function TableWrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="table-wrap" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  lang,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor: string;
  children: ReactNode;
  lang?: 'EN' | 'CY';
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>
        {label}
        {/* The space keeps the accessible name as two words: "Title English". */}
        {lang ? (
          <span className="field__lang"> {lang === 'EN' ? 'English' : 'Cymraeg'}</span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p className="hint" id={`${htmlFor}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A concept image. Pass `decorative` when text right beside it says the same thing. */
export function Media({
  id,
  size,
  decorative = false,
  className,
}: {
  id: string;
  size: 'thumb' | 'card' | 'wide';
  decorative?: boolean;
  className?: string;
}) {
  const media = mediaFor(id);
  if (!media) return <div className={`media media--${size} media--missing`}>No image</div>;
  const widths = { thumb: 96, card: 320, wide: 640 } as const;
  const width = widths[size];
  return (
    <Image
      className={['media', `media--${size}`, className].filter(Boolean).join(' ')}
      src={media.src}
      alt={decorative ? '' : media.alt}
      width={width}
      height={Math.round((width * media.height) / media.width)}
      sizes={`${width}px`}
    />
  );
}

/** Shown instead of a screen when the signed-in role may not open it. */
export function Denied({
  actor,
  permission,
  section,
}: {
  actor: Actor;
  permission: Permission;
  section: string;
}) {
  const holders = humanRolesWith(permission).map((role) => roleLabels[role]);
  return (
    <>
      <PageHeader eyebrow="Not available to your role" title={section}>
        You are signed in as {actor.name} ({roleLabels[actor.role]}). This screen needs the{' '}
        <code>{permission}</code> permission.
      </PageHeader>
      <section className="card" aria-label="Why this is not available">
        <p>{denialMessage(actor.role, permission).replace(/^Refused\. /, '')}</p>
        <p className="hint">
          {holders.length > 0
            ? `Ask a ${holders.join(' or ').toLowerCase()} if you need this, or switch demo account in the sidebar.`
            : 'No person can be given this permission.'}
        </p>
      </section>
    </>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** Text in a known language, marked up so a screen reader pronounces it correctly. */
export function Lang({ locale, children }: { locale: 'en' | 'cy'; children: ReactNode }) {
  return <span lang={locale}>{children}</span>;
}
