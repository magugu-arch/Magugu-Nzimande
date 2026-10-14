import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * A typeset wordmark standing in for the official logo, which the brief asks
 * the team to supply (launch checklist: brand/assets).
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        'group inline-flex items-baseline gap-2 whitespace-nowrap text-ivory',
        className,
      )}
    >
      <span className="font-display text-[1.4rem] leading-none font-semibold tracking-[-0.01em] md:text-[1.55rem]">
        Myron Golden
      </span>
      <span
        aria-hidden="true"
        className="size-1.5 translate-y-[-0.1rem] rotate-45 bg-gold transition-transform duration-500 group-hover:rotate-[135deg]"
      />
      <span className="sr-only">— home</span>
    </Link>
  );
}
