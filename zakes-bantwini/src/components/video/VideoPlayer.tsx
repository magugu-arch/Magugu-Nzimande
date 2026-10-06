'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { VideoSource } from '@/content/schema';
import { track } from '@/lib/analytics/client';
import styles from './VideoPlayer.module.css';

type Props = {
  slug: string;
  title: string;
  source: VideoSource | null;
  /** Poster image, rendered by the server. */
  poster: ReactNode;
  posterUrl: string;
};

function time(s: number) {
  if (!Number.isFinite(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/**
 * Cinematic player. Self-hosted files get custom controls with keyboard
 * support (Space/K play, F fullscreen, M mute, C captions, ←/→ seek) and
 * caption tracks; YouTube loads only after the viewer presses play
 * (privacy-enhanced domain, no third-party requests before consent to watch).
 */
export function VideoPlayer({ slug, title, source, poster, posterUrl }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const tracked = useRef(false);

  const markPlayed = useCallback(() => {
    if (tracked.current) return;
    tracked.current = true;
    track('video_played', { video: slug });
  }, [slug]);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const fullscreen = useCallback(() => {
    const el = frame.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    for (const t of Array.from(v.textTracks)) t.mode = captions ? 'showing' : 'hidden';
  }, [captions, started]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const v = video.current;
    if (!v || !started) return;
    const key = e.key.toLowerCase();
    // Space on a focused control already activates that control.
    if (key === ' ' && (e.target as HTMLElement).closest('button, input')) return;
    if (key === ' ' || key === 'k') {
      e.preventDefault();
      toggle();
    } else if (key === 'f') fullscreen();
    else if (key === 'm') {
      v.muted = !v.muted;
      setMuted(v.muted);
    } else if (key === 'c') setCaptions((c) => !c);
    else if (key === 'arrowright') v.currentTime = Math.min(v.duration, v.currentTime + 5);
    else if (key === 'arrowleft') v.currentTime = Math.max(0, v.currentTime - 5);
  };

  if (!source) {
    return (
      <div className={styles.frame}>
        {poster}
        <div className={styles.pending}>
          <p className="eyebrow eyebrow-accent">Film awaiting approval</p>
          <p>The official cut, with captions, publishes here once management supplies it.</p>
        </div>
      </div>
    );
  }

  if (source.type === 'youtube') {
    return (
      <div className={styles.frame} ref={frame}>
        {started ? (
          <iframe
            className={styles.iframe}
            src={`https://www.youtube-nocookie.com/embed/${source.id}?autoplay=1&rel=0&cc_load_policy=1`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <>
            {poster}
            <button
              type="button"
              className={styles.bigPlay}
              data-cursor="Watch"
              onClick={() => {
                setStarted(true);
                markPlayed();
              }}
            >
              <span aria-hidden="true">▶</span>
              <span className="visually-hidden">Play {title} (loads YouTube)</span>
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.frame} ref={frame} onKeyDown={onKey}>
      <video
        ref={video}
        className={styles.video}
        poster={posterUrl}
        preload="none"
        playsInline
        crossOrigin="anonymous"
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          markPlayed();
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onClick={toggle}
        aria-label={title}
      >
        <source src={source.src} type={source.mime} />
        {source.captions.map((c, i) => (
          <track key={c.src} kind="captions" src={c.src} srcLang={c.lang} label={c.label} default={i === 0} />
        ))}
      </video>
      {!started && (
        <button type="button" className={styles.bigPlay} onClick={toggle} data-cursor="Watch">
          <span aria-hidden="true">▶</span>
          <span className="visually-hidden">Play {title}</span>
        </button>
      )}
      {started && (
        <div className={styles.controls}>
          <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? '❚❚' : '▶'}
          </button>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={progress}
            aria-label="Seek"
            aria-valuetext={`${time(progress)} of ${time(duration)}`}
            onChange={(e) => {
              if (video.current) video.current.currentTime = Number(e.target.value);
            }}
          />
          <span className="mono-num">
            {time(progress)} / {time(duration)}
          </span>
          <button
            type="button"
            aria-pressed={muted}
            onClick={() => {
              if (!video.current) return;
              video.current.muted = !video.current.muted;
              setMuted(video.current.muted);
            }}
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>
          {source.captions.length > 0 && (
            <button type="button" aria-pressed={captions} onClick={() => setCaptions((c) => !c)}>
              CC
            </button>
          )}
          <button type="button" onClick={fullscreen}>
            Full screen
          </button>
        </div>
      )}
    </div>
  );
}
