import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/content/content.module.css';
import { TableRequestForm } from '@/components/forms/TableRequestForm';
import { JsonLd } from '@/components/site/JsonLd';
import { PageHero } from '@/components/site/PageHero';
import { Check, Utensils, WhatsAppGlyph } from '@/components/ui/icons';
import { Photo } from '@/components/ui/Photo';
import { SectionHead } from '@/components/ui/SectionHead';
import { menu } from '@/content/menu';
import { whatsappLink } from '@/content/site';
import { graph, restaurantLd } from '@/lib/jsonld';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Chaf-Pozi Restaurant & Shisanyama',
  description:
    'Shisanyama at the foot of the Soweto Towers (Orlando Towers): boerewors, braaied chicken, pap and chakalaka at Chaf-Pozi, on site. Add lunch to your jump or request a table.',
  path: '/restaurant',
  image: '/og/restaurant.jpg',
});

export default function RestaurantPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: 'Restaurant', path: '/restaurant' }]}
        image="shisanyama-platter"
        focus="50% 62%"
        eyebrow="Chaf-Pozi · On site"
        title="Jump, then braai."
        lede="Chaf-Pozi sits at the foot of the towers: shisanyama off the coals, cold drinks and a front-row seat for the next jumper."
        actions={
          <>
            <a href="#table" className="btn btn--primary btn--lg">
              Request a table
            </a>
            <Link href="/book" className="btn btn--ghost btn--lg" style={{ color: 'var(--on-dark)' }}>
              Book a jump & lunch
            </Link>
          </>
        }
      />

      <section className="section" aria-labelledby="menu-title">
        <div className="container">
          <SectionHead
            eyebrow="The menu"
            title="Off the coals."
            id="menu-title"
            intro="A taste of what’s on the fire. The full menu and prices are to be confirmed with Chaf-Pozi."
          />
          <div className={styles.menu}>
            {menu.map((section, i) => (
              <section
                key={section.section}
                className={`card ${i === 0 ? 'card--dark' : ''} reveal`}
                style={{ ['--delay' as string]: `${i * 80}ms` }}
                aria-labelledby={`menu-${i}`}
              >
                <p className="eyebrow">{i === 0 ? 'Shisanyama' : i === 1 ? 'Sides' : 'Drinks'}</p>
                <h3 id={`menu-${i}`} className="h3">
                  {section.section}
                </h3>
                <ul role="list" className={styles.menuItems}>
                  {section.items.map((item) => (
                    <li key={item.name}>
                      <strong>{item.name}</strong>
                      <span style={i === 0 ? { color: 'var(--on-dark-2)' } : undefined}>{item.description}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className={`section ${styles.deep}`} aria-labelledby="lunch-title">
        <div className={`container ${styles.split} ${styles.splitCenter}`}>
          <div className={`frame ${styles.splitMedia} reveal`}>
            <Photo slug="celebration-crowd" sizes="(min-width: 960px) 46vw, 100vw" />
          </div>
          <div className={`${styles.splitBody} reveal`}>
            <Utensils width={32} height={32} />
            <p className="eyebrow">Jump & Lunch</p>
            <h2 id="lunch-title" className="h2">
              Add lunch when you book.
            </h2>
            <p className="lede">
              Booking a jump? Tick lunch at checkout and we’ll ask Chaf-Pozi to hold a table for your group after your slot. Longer day, better story.
            </p>
            <ul role="list" className={styles.checks}>
              <li>
                <Check /> Your table lines up with your jump time
              </li>
              <li>
                <Check /> Friends who came to watch can eat while you jump
              </li>
              <li>
                <Check /> Save the drinks for after: nobody jumps under the influence
              </li>
            </ul>
            <Link href="/book" className="btn btn--dark">
              Book a jump with lunch
            </Link>
          </div>
        </div>
      </section>

      <section id="table" className="section" aria-labelledby="table-title">
        <div className={`container ${styles.split}`}>
          <div className={`${styles.splitBody} ${styles.sticky}`}>
            <p className="eyebrow">Tables</p>
            <h2 id="table-title" className="h2">
              Request a table.
            </h2>
            <p className="lede">Lunch or dinner at the towers. Send a request and we’ll confirm on WhatsApp.</p>
            <ul role="list" className={styles.checks}>
              <li>
                <Check /> Outside food, drinks and braais aren’t allowed on site
              </li>
              <li>
                <Check /> Birthday cake is welcome: please leave the site as clean as you found it
              </li>
              <li>
                <Check /> The site is cash-free, so please pay by card
              </li>
            </ul>
            <a className="btn btn--light" href={whatsappLink('Hi! I’d like to book a table at Chaf-Pozi for ')} target="_blank" rel="noopener">
              <WhatsAppGlyph size={18} /> Ask on WhatsApp
            </a>
          </div>
          <div className="card">
            <TableRequestForm />
          </div>
        </div>
      </section>

      <JsonLd data={graph(restaurantLd(menu))} />
    </>
  );
}
