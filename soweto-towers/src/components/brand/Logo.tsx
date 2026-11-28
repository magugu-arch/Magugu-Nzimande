import { MARK_VIEWBOX, markPaths } from './mark-paths';
import styles from './Logo.module.css';

export function Mark({ tone = 'ink', size = 34, title }: { tone?: 'ink' | 'paper'; size?: number; title?: string }) {
  const detail = tone === 'ink' ? '#1E2020' : '#F4F3EF';
  const id = `tw-${tone}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox={MARK_VIEWBOX}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={styles.mark}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EE7A45" />
          <stop offset="1" stopColor="#D94A1E" />
        </linearGradient>
      </defs>
      <path d={markPaths.towerWest} fill={`url(#${id})`} />
      <path d={markPaths.towerEast} fill={`url(#${id})`} />
      <path d={markPaths.bridge} stroke={detail} strokeWidth={2.2} strokeLinecap="round" fill="none" />
      <path d={markPaths.cord} stroke={detail} strokeWidth={1.3} strokeLinecap="round" fill="none" />
      <circle cx={markPaths.jumper.cx} cy={markPaths.jumper.cy} r={markPaths.jumper.r} fill={detail} />
    </svg>
  );
}

/** Mark + wordmark. 'ink' for light backgrounds, 'paper' for dark. */
export function Logo({ tone = 'ink', size = 34 }: { tone?: 'ink' | 'paper'; size?: number }) {
  return (
    <span className={`${styles.logo} ${tone === 'paper' ? styles.paper : ''}`}>
      <Mark tone={tone} size={size} />
      <span className={styles.words}>
        <span className={styles.name}>Soweto Towers</span>
        <span className={styles.line}>From the top</span>
      </span>
    </span>
  );
}
