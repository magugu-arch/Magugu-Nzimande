import { FadeIn } from './ui/ImageReveal';

export const processSteps = [
  { name: 'Discover', text: 'We listen first — to you, the occasion, and how you want to feel wearing it.' },
  { name: 'Design', text: 'Sketches, fabric and silhouette come together into a direction that is unmistakably yours.' },
  { name: 'Fit', text: 'The garment is cut and built to your measurements, then fitted on you.' },
  { name: 'Refine', text: 'We adjust, fit again and perfect every detail until it sits exactly right.' },
  { name: 'Deliver', text: 'Your finished piece, made for one person, ready for its moment.' },
];

/** Discover → Design → Fit → Refine → Deliver (brief §20.4). */
export function Process({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const line = tone === 'dark' ? 'border-line' : 'border-ink-line';
  return (
    <ol className="grid gap-px sm:grid-cols-2 lg:grid-cols-5">
      {processSteps.map((step, i) => (
        <FadeIn as="li" key={step.name} delay={i * 0.08} className={`border-t ${line} pt-6 pb-10 lg:pr-6`}>
          <span className="ui-label opacity-50">{String(i + 1).padStart(2, '0')}</span>
          <h3 className="mt-6 font-serif text-4xl italic">{step.name}</h3>
          <p className="mt-4 max-w-xs opacity-70">{step.text}</p>
        </FadeIn>
      ))}
    </ol>
  );
}
