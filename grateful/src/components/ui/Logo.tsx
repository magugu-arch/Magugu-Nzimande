import lockup from '../../assets/logo/grateful-lockup.svg?raw';
import monogram from '../../assets/logo/grateful-monogram.svg?raw';

/**
 * The Grateful logo, drawn from the vector artwork in the CI manual (page 2,
 * "The Logo") — not redrawn or reset in type. Inlined so it takes the
 * surrounding text colour, which is how the CI's monotone-on-white and
 * monotone-on-black applications work.
 */
export function Logo({ variant = 'lockup', className = '' }: { variant?: 'lockup' | 'monogram'; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Grateful"
      className={`logo-svg inline-block ${variant === 'lockup' ? 'aspect-[518/82]' : 'aspect-[48/68]'} ${className}`}
      dangerouslySetInnerHTML={{ __html: variant === 'lockup' ? lockup : monogram }}
    />
  );
}

/** The circular monogram stamp, after the CI's "other applications" page. */
export function MonogramSeal({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex aspect-square flex-col items-center justify-center rounded-full ${light ? 'bg-white text-black' : 'bg-black text-white'} ${className}`}
    >
      <Logo variant="monogram" className="w-[26%]" />
      <span className="mt-[6%] font-serif text-[0.62em] tracking-[0.08em]">GRATEFUL</span>
    </span>
  );
}
