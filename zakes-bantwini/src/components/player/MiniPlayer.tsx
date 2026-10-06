'use client';

import Link from 'next/link';
import { usePlayer } from './PlayerProvider';
import styles from './MiniPlayer.module.css';

const LINK_LABELS: Record<string, string> = {
  spotify: 'Spotify',
  appleMusic: 'Apple Music',
  youtube: 'YouTube',
  deezer: 'Deezer',
};

function time(s: number) {
  if (!Number.isFinite(s) || s <= 0) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/** Bottom mini-player: playing now / play / pause / previous / next / volume / open. */
export function MiniPlayer() {
  const p = usePlayer();
  if (!p.visible || !p.current) return null;
  const item = p.current;
  const canPlay = Boolean(item.audioUrl);
  const links = Object.entries(item.links).filter(([, url]) => Boolean(url)) as [string, string][];

  return (
    <section className={styles.bar} aria-label="Music player">
      {canPlay && p.duration > 0 && (
        <div className={styles.progress} aria-hidden="true">
          <span style={{ transform: `scaleX(${p.progress / p.duration})` }} />
        </div>
      )}

      <div className={styles.now}>
        <span className="eyebrow">{canPlay ? (p.playing ? 'Playing now' : 'Paused') : 'Up next'}</span>
        <p className={styles.title}>
          <span>{item.title}</span>
          <span className={styles.subtitle}>{item.subtitle}</span>
        </p>
      </div>

      <div className={styles.controls}>
        <button type="button" onClick={p.prev} disabled={p.index === 0 && !canPlay} aria-label="Previous">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 5h2v14H6zM20 5v14L9 12z" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.play}
          onClick={p.toggle}
          disabled={!canPlay}
          aria-label={p.playing ? 'Pause' : 'Play'}
          aria-describedby={canPlay ? undefined : 'player-unavailable'}
        >
          {p.playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          )}
        </button>
        <button type="button" onClick={p.next} disabled={p.index >= p.queue.length - 1} aria-label="Next">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 5h2v14h-2zM4 5v14l11-7z" fill="currentColor" />
          </svg>
        </button>
        {canPlay && (
          <span className={`${styles.time} mono-num`} aria-hidden="true">
            {time(p.progress)} / {time(p.duration)}
          </span>
        )}
      </div>

      <div className={styles.side}>
        {canPlay ? (
          <label className={styles.volume}>
            <span className="visually-hidden">Volume</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" fill="currentColor" />
            </svg>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={p.volume}
              onChange={(e) => p.setVolume(Number(e.target.value))}
            />
          </label>
        ) : (
          <p id="player-unavailable" className={styles.unavailable} aria-live="polite">
            Preview awaiting approval. Listen on{' '}
            {links.map(([key, url], i) => (
              <span key={key}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {LINK_LABELS[key] ?? key}
                </a>
                {i < links.length - 1 ? ', ' : '.'}
              </span>
            ))}
          </p>
        )}
        <Link href={item.href} className={styles.open}>
          Open
        </Link>
        <button type="button" className={styles.close} onClick={p.close} aria-label="Close player">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </section>
  );
}
