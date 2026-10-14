'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { PlayIcon } from '../ui/icons';

/**
 * Thumbnail-to-play (brief §6, Learn). Nothing from YouTube loads until the
 * visitor asks for it, and then only the privacy-enhanced player, with
 * captions on by default. With no official video id yet, it says so instead
 * of pretending to play.
 */
export function VideoFacade({
  youtubeId,
  title,
  poster,
  className,
}: {
  youtubeId: string | null;
  title: string;
  poster: React.ReactNode;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'playing' | 'unavailable'>('idle');

  return (
    <div
      className={cn(
        'relative aspect-video overflow-hidden rounded-[1.5rem] bg-charcoal ring-1 ring-ivory/10',
        className,
      )}
    >
      {state === 'playing' && youtubeId ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&rel=0&cc_load_policy=1&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          onClick={() => setState(youtubeId ? 'playing' : 'unavailable')}
          className="group absolute inset-0 block text-left"
        >
          {poster}
          <span className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="pressable grid size-18 place-items-center rounded-full bg-gold text-ink shadow-[0_20px_60px_-15px_rgb(203_164_93/0.8)] transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:scale-105 group-active:scale-95 md:size-22">
              <PlayIcon size={30} className="translate-x-0.5" />
            </span>
          </span>
          <span className="sr-only">Play video: {title}</span>
        </button>
      )}
      {state === 'unavailable' ? (
        <div
          role="status"
          className="material absolute inset-x-4 bottom-4 rounded-xl bg-ink/80 p-4 text-[0.9rem] text-ivory/90 backdrop-blur-md"
        >
          This video will play here once the official upload is linked. Until then, find Myron’s
          latest teaching on his official channels.
        </div>
      ) : null}
    </div>
  );
}
