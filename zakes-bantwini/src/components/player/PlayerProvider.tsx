'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { StreamingLinks } from '@/content/schema';
import type { MediaId } from '@/content/media';
import { track } from '@/lib/analytics/client';

export type QueueItem = {
  id: string;
  title: string;
  subtitle: string;
  /** Page that "Open" leads to — the album or release. */
  href: string;
  /** Approved audio. Without it the player shows where to listen instead. */
  audioUrl?: string;
  links: StreamingLinks;
  mood?: MediaId;
};

type PlayerState = {
  queue: QueueItem[];
  index: number;
  playing: boolean;
  volume: number;
  progress: number;
  duration: number;
  visible: boolean;
};

type PlayerApi = PlayerState & {
  current: QueueItem | null;
  playQueue: (items: QueueItem[], start?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  close: () => void;
};

const PlayerContext = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
}

/**
 * One <audio> element for the whole site, owned by the (site) layout so it
 * survives client navigation — the persistent player the brief asks for.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const played = useRef(new Set<string>());
  const [state, setState] = useState<PlayerState>({
    queue: [],
    index: 0,
    playing: false,
    volume: 0.9,
    progress: 0,
    duration: 0,
    visible: false,
  });

  const current = state.queue[state.index] ?? null;

  useEffect(() => {
    const el = new Audio();
    el.preload = 'none';
    audio.current = el;
    const onTime = () => setState((s) => ({ ...s, progress: el.currentTime, duration: el.duration || 0 }));
    const onEnd = () =>
      setState((s) => (s.index < s.queue.length - 1 ? { ...s, index: s.index + 1 } : { ...s, playing: false }));
    const onPause = () => setState((s) => ({ ...s, playing: false }));
    const onPlay = () => setState((s) => ({ ...s, playing: true }));
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    el.addEventListener('pause', onPause);
    el.addEventListener('play', onPlay);
    return () => {
      el.pause();
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('play', onPlay);
    };
  }, []);

  // Load the current item whenever it changes.
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    if (!current?.audioUrl) {
      el.pause();
      el.removeAttribute('src');
      return;
    }
    if (el.src !== new URL(current.audioUrl, window.location.href).href) {
      el.src = current.audioUrl;
      el.currentTime = 0;
    }
    if (state.playing) {
      void el.play().catch(() => setState((s) => ({ ...s, playing: false })));
      if (!played.current.has(current.id)) {
        played.current.add(current.id);
        track('music_played', { item: current.id });
      }
    }
  }, [current, state.playing]);

  useEffect(() => {
    if (audio.current) audio.current.volume = state.volume;
  }, [state.volume]);

  // Keep page content clear of the bar.
  useEffect(() => {
    document.documentElement.style.setProperty('--player-h', state.visible ? '76px' : '0px');
  }, [state.visible]);

  const playQueue = useCallback((items: QueueItem[], start = 0) => {
    const first = items[start];
    setState((s) => ({
      ...s,
      queue: items,
      index: start,
      visible: true,
      progress: 0,
      duration: 0,
      playing: Boolean(first?.audioUrl),
    }));
  }, []);

  const toggle = useCallback(() => {
    const el = audio.current;
    if (!el || !current?.audioUrl) return;
    if (el.paused) setState((s) => ({ ...s, playing: true }));
    else el.pause();
  }, [current]);

  const step = useCallback((delta: number) => {
    setState((s) => {
      const index = Math.min(Math.max(s.index + delta, 0), s.queue.length - 1);
      return { ...s, index, progress: 0, playing: Boolean(s.queue[index]?.audioUrl) && s.playing };
    });
  }, []);

  const api = useMemo<PlayerApi>(
    () => ({
      ...state,
      current,
      playQueue,
      toggle,
      next: () => step(1),
      prev: () => {
        const el = audio.current;
        if (el && el.currentTime > 3) el.currentTime = 0;
        else step(-1);
      },
      seek: (seconds) => {
        if (audio.current) audio.current.currentTime = seconds;
      },
      setVolume: (volume) => setState((s) => ({ ...s, volume })),
      close: () => {
        audio.current?.pause();
        setState((s) => ({ ...s, visible: false, playing: false }));
      },
    }),
    [state, current, playQueue, toggle, step],
  );

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}
