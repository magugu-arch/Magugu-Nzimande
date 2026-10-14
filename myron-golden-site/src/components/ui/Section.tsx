import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'ink' | 'charcoal' | 'ivory' | 'midnight';

const toneClasses: Record<Tone, string> = {
  ink: 'bg-ink text-ivory',
  charcoal: 'bg-charcoal text-ivory',
  midnight: 'bg-midnight text-ivory',
  ivory: 'surface-ivory bg-ivory text-ink',
};

export function Section({
  tone = 'ink',
  children,
  className,
  id,
  labelledBy,
  grain = false,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
  grain?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(toneClasses[tone], 'py-20 md:py-28', grain && 'grain', className)}
    >
      {children}
    </section>
  );
}

export function Eyebrow({
  children,
  tone = 'dark',
  className,
}: {
  children: ReactNode;
  tone?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <p
      className={cn(
        'type-eyebrow flex items-center gap-3',
        tone === 'dark' ? 'text-gold' : 'text-gold-deep',
        className,
      )}
    >
      <span aria-hidden="true" className="h-px w-8 bg-current opacity-70" />
      {children}
    </p>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  tone = 'dark',
  align = 'left',
  as: Heading = 'h2',
  size = 'lg',
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  tone?: 'dark' | 'light';
  align?: 'left' | 'center';
  as?: 'h1' | 'h2' | 'h3';
  size?: 'lg' | 'md';
  className?: string;
}) {
  return (
    <div
      data-reveal
      className={cn(
        'max-w-3xl',
        align === 'center' && 'mx-auto text-center [&_.type-eyebrow]:justify-center',
        className,
      )}
    >
      {eyebrow ? (
        <Eyebrow tone={tone} className="mb-5">
          {eyebrow}
        </Eyebrow>
      ) : null}
      <Heading id={id} className={size === 'lg' ? 'type-display-lg' : 'type-display-md'}>
        {title}
      </Heading>
      {intro ? (
        <p
          className={cn(
            'type-lede mt-5 max-w-2xl',
            align === 'center' && 'mx-auto',
            tone === 'dark' ? 'text-ivory/75' : 'text-slate',
          )}
        >
          {intro}
        </p>
      ) : null}
    </div>
  );
}

export function Pill({
  children,
  tone = 'gold',
  className,
}: {
  children: ReactNode;
  tone?: 'gold' | 'muted' | 'demo' | 'light';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase',
        tone === 'gold' && 'bg-gold/15 text-gold-bright ring-1 ring-gold/30',
        tone === 'muted' && 'bg-ivory/[0.07] text-ivory/80 ring-1 ring-ivory/15',
        tone === 'demo' && 'bg-[#3a2f1a] text-gold-bright ring-1 ring-gold/40',
        tone === 'light' && 'bg-ink/[0.06] text-ink/75 ring-1 ring-ink/15',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A thin gold rule with a centred diamond — the site's one ornament. */
export function GoldRule({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex items-center gap-3 text-gold/70', className)}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-current" />
      <span className="size-1.5 rotate-45 border border-current" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-current" />
    </div>
  );
}
