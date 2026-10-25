import { Fragment } from 'preact';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.tsx';
import { image } from '../images.ts';
import { pop } from '../nav.ts';

// ------------------------------------------------------------ pressing

/**
 * Feedback on pointer-down, not on release: adds `.pressed` instantly (iOS
 * Safari does not apply :active without a touch listener), and cancels it if
 * the finger slides away more than 10px.
 */
export function usePress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    const down = (e: PointerEvent) => {
      sx = e.clientX;
      sy = e.clientY;
      el.classList.add('pressed');
    };
    const move = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) el.classList.remove('pressed');
    };
    const up = () => el.classList.remove('pressed');
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', up);
    };
  }, []);
  return ref;
}

type BtnProps = JSX.HTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'quiet' | 'danger' | 'default' | 'on-photo';
  small?: boolean;
  block?: boolean;
  icon?: string;
  busy?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
};

export function Button({ variant = 'default', small, block, icon, busy, children, class: cls, disabled, type = 'button', ...rest }: BtnProps) {
  const ref = usePress<HTMLButtonElement>();
  const classes = ['btn', variant !== 'default' ? variant : '', small ? 'small' : '', block ? 'block' : '', (cls as string) ?? ''].join(' ');
  return (
    <button ref={ref} type={type} class={classes} disabled={disabled || busy} aria-busy={busy ? 'true' : undefined} {...rest}>
      {busy ? <span class="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : icon ? <Icon name={icon} size={19} /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = 'default', small, icon, block }: { href: string; children: ComponentChildren; variant?: 'primary' | 'default' | 'quiet'; small?: boolean; icon?: string; block?: boolean }) {
  const ref = usePress<HTMLAnchorElement>();
  return (
    <a ref={ref} class={`btn ${variant !== 'default' ? variant : ''} ${small ? 'small' : ''} ${block ? 'block' : ''}`} href={href} target="_blank" rel="noopener noreferrer">
      {icon ? <Icon name={icon} size={19} /> : null}
      {children}
    </a>
  );
}

export function IconButton({ icon, label, onClick, badge, size = 22 }: { icon: string; label: string; onClick?: () => void; badge?: number; size?: number }) {
  const ref = usePress<HTMLButtonElement>();
  return (
    <button ref={ref} type="button" class="iconbtn" aria-label={badge ? `${label}, ${badge} unread` : label} onClick={onClick}>
      <Icon name={icon} size={size} />
      {badge ? <span class="badge-dot">{badge > 9 ? '9+' : badge}</span> : null}
    </button>
  );
}

// ------------------------------------------------------------- photo

export function Photo({ id, ratio, class: cls, eager, rounded }: { id: string; ratio?: string; class?: string; eager?: boolean; rounded?: 'lg' | '0' }) {
  const img = image(id);
  return (
    <div class={`photo ${rounded ? `r-${rounded}` : ''} ${cls ?? ''}`} style={ratio ? { aspectRatio: ratio } : undefined}>
      {img.src ? (
        <img src={img.src} alt={img.alt} width={img.w} height={img.h} loading={eager ? 'eager' : 'lazy'} decoding="async" />
      ) : (
        <span class="vh">{img.alt}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------- controls

export function Toggle({ checked, onChange, label, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      class="toggle"
      aria-checked={checked ? 'true' : 'false'}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

/** The thumb is measured and slides to the chosen segment. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const btn = el.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (btn) setThumb({ x: btn.offsetLeft - 3, w: btn.offsetWidth });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [value, options.length]);
  return (
    <div class="segmented" role="group" aria-label={label} ref={ref}>
      {thumb ? <span class="thumb" style={{ width: `${thumb.w}px`, transform: `translateX(${thumb.x}px)` }} /> : null}
      {options.map((o) => (
        <button type="button" key={o.value} aria-pressed={o.value === value ? 'true' : 'false'} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, min, max, onChange, label, unit }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string; unit?: (n: number) => string }) {
  return (
    <div class="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Icon name="minus" size={18} />
      </button>
      <output aria-live="polite" aria-label={unit ? unit(value) : String(value)}>
        {value}
      </output>
      <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string | null; hint?: string; children: ComponentChildren }) {
  return (
    <div class="field">
      <label for={id}>{label}</label>
      {children}
      {error ? (
        <span class="field-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span class="footnote">{hint}</span>
      ) : null}
    </div>
  );
}

export function Check({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ComponentChildren }) {
  return (
    <label class="check" for={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span class="callout" style={{ color: 'var(--ink)' }}>
        {children}
      </span>
    </label>
  );
}

export function SampleTag({ label = 'Sample' }: { label?: string }) {
  return (
    <span class="tag sample" title="Placeholder content until Tashas approves the real data">
      {label}
    </span>
  );
}

export function Banner({ tone = 'warn', icon, children }: { tone?: 'warn' | 'good' | 'bad' | 'neutral'; icon?: string; children: ComponentChildren }) {
  const cls = tone === 'warn' ? '' : tone;
  return (
    <div class={`banner ${cls}`} role={tone === 'bad' ? 'alert' : undefined}>
      <Icon name={icon ?? (tone === 'good' ? 'check' : tone === 'bad' ? 'alert' : 'info')} size={20} />
      <div class="stack-sm">{children}</div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <Icon name={icon} size={34} stroke={1.3} />
      <p class="title-3" style={{ color: 'var(--ink)' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

export function SectionHead({ title, action, eyebrow }: { title: string; action?: ComponentChildren; eyebrow?: string }) {
  return (
    <div class="section-head">
      <div class="stack-sm">
        {eyebrow ? <span class="caption">{eyebrow}</span> : null}
        <h2 class="title-2">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Row({ icon, title, sub, meta, onClick, href, chevron = true, danger }: { icon?: string; title: ComponentChildren; sub?: ComponentChildren; meta?: ComponentChildren; onClick?: () => void; href?: string; chevron?: boolean; danger?: boolean }) {
  const inner = (
    <>
      {icon ? (
        <span class="lead" style={danger ? { background: 'var(--danger-soft)', color: 'var(--danger)' } : undefined}>
          <Icon name={icon} size={18} />
        </span>
      ) : null}
      <span class="stack-sm grow">
        <span style={{ fontWeight: 560, color: danger ? 'var(--danger)' : undefined }}>{title}</span>
        {sub ? <span class="footnote">{sub}</span> : null}
      </span>
      {meta !== undefined || chevron ? (
        <span class="meta">
          {meta}
          {chevron && (onClick || href) ? <Icon name={href ? 'external' : 'chevron'} size={href ? 16 : 18} /> : null}
        </span>
      ) : null}
    </>
  );
  if (href)
    return (
      <a class="list-row" href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  if (onClick)
    return (
      <button type="button" class="list-row" onClick={onClick}>
        {inner}
      </button>
    );
  return <div class="list-row">{inner}</div>;
}

// ------------------------------------------------------- navigation bar

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let n = el?.parentElement ?? null;
  while (n && !n.classList.contains('page')) n = n.parentElement;
  return n;
}

/**
 * Large title that hands over to the compact bar as it scrolls under it,
 * with the translucent material fading in only once content is beneath.
 */
export function NavBar({
  title,
  large = true,
  back = false,
  leading,
  trailing,
  onPhoto = false,
}: {
  title: string;
  large?: boolean;
  back?: boolean;
  leading?: ComponentChildren;
  trailing?: ComponentChildren;
  onPhoto?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const bar = ref.current;
    const page = scrollParent(bar);
    if (!bar || !page) return;
    const threshold = onPhoto ? 220 : large ? 44 : 4;
    const update = () => {
      const y = page.scrollTop;
      const edge = Math.max(0, Math.min(1, (y - threshold * 0.4) / (threshold * 0.6)));
      bar.style.setProperty('--edge', String(edge));
      bar.classList.toggle('scrolled', edge > 0.5);
      if (titleRef.current) {
        const s = y < 0 ? 1 + Math.min(0.06, -y / 900) : 1;
        titleRef.current.style.transform = `scale(${s})`;
        titleRef.current.style.opacity = String(Math.max(0, 1 - y / 70));
      }
    };
    update();
    page.addEventListener('scroll', update, { passive: true });
    return () => page.removeEventListener('scroll', update);
  }, [large, onPhoto]);
  return (
    <>
      <div class="navbar" ref={ref} style={onPhoto ? { marginBottom: '-62px' } : undefined}>
        <div class="navbar-side">{back ? <IconButton icon="back" label="Back" onClick={() => pop()} /> : leading}</div>
        <div class="navbar-title" aria-hidden={large ? 'true' : undefined}>
          {title}
        </div>
        <div class="navbar-side end">{trailing}</div>
      </div>
      {large ? (
        <h1 class="title-1 large-title" ref={titleRef}>
          {title}
        </h1>
      ) : null}
    </>
  );
}

// -------------------------------------------------------------- toasts

type ToastItem = { id: number; text: string; icon: string };
let toasts: ToastItem[] = [];
const toastListeners = new Set<() => void>();
let toastId = 1;

export function toast(text: string, icon = 'check'): void {
  const t = { id: toastId++, text, icon };
  toasts = [...toasts, t].slice(-3);
  toastListeners.forEach((l) => l());
  window.setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l());
  }, 3200);
}

export function Toasts() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    toastListeners.add(l);
    return () => {
      toastListeners.delete(l);
    };
  }, []);
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div class="toast" key={t.id}>
          <Icon name={t.icon} size={18} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------- misc

export function KV({ rows }: { rows: [ComponentChildren, ComponentChildren][] }) {
  return (
    <dl class="kv">
      {rows.map(([k, v], i) => (
        <Fragment key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function Disclosure({ summary, children, open }: { summary: ComponentChildren; children: ComponentChildren; open?: boolean }) {
  return (
    <details class="disclosure" open={open}>
      <summary>
        <span>{summary}</span>
        <Icon name="down" size={18} />
      </summary>
      <div class="disclosure-body">{children}</div>
    </details>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as Error).message);
  return 'Something went wrong. Please try again.';
}
