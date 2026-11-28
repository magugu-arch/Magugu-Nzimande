import type { Metadata } from 'next';
import styles from '@/components/content/content.module.css';
import { EnquiryForm } from '@/components/forms/EnquiryForm';
import { PageHero } from '@/components/site/PageHero';
import { ArrowUpRight, Check } from '@/components/ui/icons';
import { SectionHead } from '@/components/ui/SectionHead';
import { site } from '@/content/site';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Partner With Us: Tours, Hotels & Brands',
  description:
    'Sell Soweto from the top. Partner programmes for tour operators, hotels and backpackers, experience marketplaces, universities, schools, corporate HR and brands at Soweto Towers (Orlando Towers).',
  path: '/partners',
  image: '/og/partners.jpg',
});

const partners = [
  { title: 'Tour operators', text: 'Commission and priority slots for your weekday tourist groups.', dark: false },
  { title: 'Hotels & backpackers', text: 'Concierge voucher packs and a referral code for your front desk.', dark: false },
  { title: 'Experience marketplaces', text: 'Instant-book packages for visitors who plan before they fly.', dark: false },
  { title: 'Restaurant bundle', text: 'Jump & Lunch on site with Chaf-Pozi, for longer, higher-value visits.', dark: false },
  { title: 'Universities & clubs', text: 'Group rates for orientation weeks and end-of-exam outings.', dark: false },
  { title: 'Corporate HR', text: 'Team-day packages with quotes and invoicing, on Thursdays and Fridays.', dark: false },
  { title: 'High schools', text: 'A lift ride and heritage outing for learners 12 and older.', dark: false },
  { title: 'Brand partners', text: 'Presenting partnerships, activations and content series on a landmark with weight.', dark: true },
];

export default function PartnersPage() {
  const host = new URL(site.url).host;
  return (
    <>
      <PageHero
        crumbs={[{ name: 'Partner with us', path: '/partners' }]}
        image="soweto-street-tour"
        eyebrow="Partner with us"
        title="Partners who sell Soweto from the top."
        lede="Tour operators, hotels, schools, universities, companies and brands: each partner gets its own offer and a tracked link."
        actions={
          <a href="#enquire" className="btn btn--primary btn--lg">
            Become a partner
          </a>
        }
      />

      <section className="section" aria-labelledby="types-title">
        <div className="container">
          <SectionHead
            eyebrow="Who we work with"
            title="One landmark, many ways in."
            id="types-title"
            intro="Tell us who your guests or members are and we’ll shape the offer around them."
          />
          <div className="grid grid--4">
            {partners.map((p, i) => (
              <div key={p.title} className={`card ${p.dark ? 'card--dark' : ''} reveal`} style={{ ['--delay' as string]: `${(i % 4) * 60}ms` }}>
                <p className="eyebrow">0{i + 1}</p>
                <h3 className="h3">{p.title}</h3>
                <p className="muted">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`section ${styles.deep}`} aria-labelledby="links-title">
        <div className={`container ${styles.split} ${styles.splitCenter}`}>
          <div className={`${styles.splitBody} reveal`}>
            <p className="eyebrow">Tracked links</p>
            <h2 id="links-title" className="h2">
              Every booking you send is counted.
            </h2>
            <p className="lede">
              Each partner gets a short code. Share your link, and every booking made through it carries your code, so commission and reports are simple.
            </p>
            <ul role="list" className={styles.checks}>
              <li>
                <Check /> Your link: <code>{host}/p/YOURCODE</code>
              </li>
              <li>
                <Check /> Or add <code>?ref=YOURCODE</code> to any page on the site
              </li>
              <li>
                <Check /> The code is remembered for 30 days on that phone or computer
              </li>
              <li>
                <Check /> Monthly report of bookings and value by code
              </li>
            </ul>
          </div>
          <div className="card card--dark reveal">
            <p className="eyebrow">Media</p>
            <h3 className="h3">Press, film and content</h3>
            <p className="muted">
              Media enquiries, film shoots, photography and location hire: tell us what you’re planning. For location and venue hire you can also email{' '}
              {site.emailVenue}.
            </p>
            <a href={`mailto:${site.emailVenue}`} className="link-arrow" style={{ color: 'var(--on-dark)' }}>
              Email about a shoot <ArrowUpRight />
            </a>
          </div>
        </div>
      </section>

      <section id="enquire" className="section" aria-labelledby="enquire-title">
        <div className={`container ${styles.split}`}>
          <div className={`${styles.splitBody} ${styles.sticky}`}>
            <p className="eyebrow">Get in touch</p>
            <h2 id="enquire-title" className="h2">
              Let’s build it together.
            </h2>
            <p className="lede">Send a few details and the right person on the team will come back to you.</p>
          </div>
          <div className="card">
            <EnquiryForm
              types={['partner', 'tour_operator', 'hotel', 'media']}
              page="/partners"
              showGroupSize={false}
              showDate={false}
              messagePlaceholder="Who are your guests or audience, and what would you like to offer them?"
            />
          </div>
        </div>
      </section>
    </>
  );
}
