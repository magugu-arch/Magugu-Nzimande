import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/content/content.module.css';
import { JsonLd } from '@/components/site/JsonLd';
import { PageHero } from '@/components/site/PageHero';
import { FaqList } from '@/components/ui/FaqList';
import { WhatsAppGlyph } from '@/components/ui/icons';
import { faqs, type Faq } from '@/content/faq';
import { whatsappLink } from '@/content/site';
import { faqPage, graph } from '@/lib/jsonld';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'FAQ: Bookings, Safety, Groups & Videos',
  description:
    'Answers about booking, opening hours, age and weight limits, weather, groups, videos and Scream Clips at Soweto Towers (Orlando Towers) in Soweto.',
  path: '/faq',
  image: '/og/faq.jpg',
});

const order: Faq['group'][] = ['Booking', 'On the day', 'Safety', 'Media', 'Groups'];
const titles: Record<Faq['group'], string> = {
  Booking: 'Booking & prices',
  'On the day': 'On the day',
  Safety: 'Safety',
  Media: 'Video & photos',
  Groups: 'Groups',
};

const slug = (g: string) => g.toLowerCase().replace(/[^a-z]+/g, '-');

export default function FaqPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: 'FAQ', path: '/faq' }]}
        eyebrow="Questions"
        title="Ask us anything."
        lede="The questions we hear most, answered straight. Still wondering? The crew is a message away."
        actions={
          <>
            <a href={whatsappLink('Hi Soweto Towers! I have a question: ')} className="btn btn--primary" target="_blank" rel="noopener">
              <WhatsAppGlyph size={18} /> WhatsApp the crew
            </a>
            <Link href="/book" className="btn btn--dark">
              Book your jump
            </Link>
          </>
        }
      />

      <nav aria-label="FAQ topics" className="container">
        <ul role="list" className="cluster">
          {order.map((g) => (
            <li key={g}>
              <a href={`#${slug(g)}`} className="pill pill--outline">
                {titles[g]}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {order.map((g) => {
        const items = faqs.filter((f) => f.group === g);
        if (items.length === 0) return null;
        return (
          <section
            key={g}
            id={slug(g)}
            className="section section--tight"
            aria-labelledby={`${slug(g)}-title`}
            style={{ scrollMarginTop: 'calc(var(--header-h) + 16px)' }}
          >
            <div className="container">
              <p className="eyebrow">{g}</p>
              <h2 id={`${slug(g)}-title`} className="h2" style={{ marginBottom: 20 }}>
                {titles[g]}
              </h2>
              <FaqList items={items} name={`faq-${slug(g)}`} />
            </div>
          </section>
        );
      })}

      <section className="section section--tight" aria-label="Still have a question?">
        <div className="container">
          <div className={`card card--dark ${styles.center}`}>
            <p className="eyebrow">Still wondering?</p>
            <p className="h3">Real people, on site, Thursday to Sunday.</p>
            <div className="cluster" style={{ justifyContent: 'center' }}>
              <a href={whatsappLink('Hi Soweto Towers! ')} className="btn btn--primary" target="_blank" rel="noopener">
                <WhatsAppGlyph size={18} /> WhatsApp us
              </a>
              <Link href="/contact" className="btn btn--ghost" style={{ color: 'var(--on-dark)' }}>
                Other ways to reach us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <JsonLd data={graph(faqPage(faqs.map((f) => ({ q: f.q, a: f.a }))))} />
    </>
  );
}
