'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { CheckIcon, CopyIcon } from './icons';

export function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className={cn(
        'pressable inline-flex h-10 items-center gap-2 rounded-full px-4 text-[0.85rem] font-semibold ring-1 ring-ink/15 hover:bg-ink/5',
        className,
      )}
    >
      {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}
