import type { Metadata } from 'next';
import Link from 'next/link';
import { CtaBand } from '@/components/content/CtaBand';
import styles from '@/components/content/content.module.css';
import { EnquiryForm } from '@/components/forms/EnquiryForm';
import { PageHero } from '@/components/site/PageHero';
import { FaqList } from '@/components/ui/FaqList';
import { ArrowUpRight, Calendar, Check, Spark, Users } from '@/components/ui/icons';
import { Photo } from '@/components/ui/Photo';
import { SectionHead } from '@/components/ui/SectionHead';
import { faqs } from '@/content/faq';
import { getLiveCatalog } from '@/lib/data/settings';
import { rand } from '@/lib/format';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Group Bookings, Team Days & Schools',
  description:
    'Celebrations, corporate team days, school outings and tour groups at Soweto Towers (Orlando Towers). Group rates from 6 jumpers, quotes with invoicing, Thursdays and Fridays for big groups.',
  path: '/groups',
  image: '/og/groups.jpg',
});

export default async function GroupsPage() {
  const catalog = await getLiveCatalog();
  const grouped = catalog.filter((a) => a.group && !a.disabled);
  const groupFaqs = faqs.filter((f) => f.group === 'Groups');

  return (
    <>
      <PageHero
        crumbs={[{ name: 'Groups', path: '/groups' }]}
        image="team-day"
        eyebrow="Groups"
        title="Bring the whole crew."
        lede="Birthdays, team days, school outings and tour groups. Thursdays and Fridays are the quietest days at the towers, which makes them the best days for groups."
        actions={
          <>
            <a href="#enquire" className="btn btn--primary btn--lg">
              Plan a group day
            </a>
            <Link href="/book" className="btn btn--ghost btn--lg" style={{ color: 'var(--on-dark)' }}>
              Book for 6+ online
            </Link>
          </>
        }
      />

      <section className="section section--tight" aria-labelledby="rates-title">
        <div className="container">
          <SectionHead
            eyebrow="Group rates"
            title="Bigger group, better price."
            id="rates-title"
            intro="Group rates apply automatically when you book online for enough people. For 15 or more, send us your numbers and we’ll put a day together, paid upfront, with an invoice for companies."
          />
          <div className={`${styles.tableWrap} reveal`}>
            {/* Roles keep the table semantics when phones restyle rows as cards. */}
            <table className={`${styles.table} ${styles.stack}`} role="table">
              <caption className="visually-hidden">Group rates at Soweto Towers</caption>
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    Adventure
                  </th>
                  <th scope="col" role="columnheader">
                    Standard
                  </th>
                  <th scope="col" role="columnheader">
                    Group rate
                  </th>
                  <th scope="col" role="columnheader">
                    From
                  </th>
                  <th scope="col" role="columnheader">
                    You save
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {grouped.map((a) => (
                  <tr key={a.id} role="row">
                    <th scope="row" role="rowheader">
                      {a.name}
                    </th>
                    <td role="cell" data-label="Standard" className={styles.num}>
                      {rand(a.price)}
                    </td>
                    <td role="cell" data-label="Group rate" className={styles.num}>
                      {rand(a.group!.price)} each
                    </td>
                    <td role="cell" data-label="From">
                      {a.group!.min} people
                    </td>
                    <td role="cell" data-label="You save" className={styles.num}>
                      {rand(a.price - a.group!.price)} per person
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="celebrations" className="section" aria-labelledby="celebrate-title">
        <div className={`container ${styles.split} ${styles.splitCenter}`}>
          <div className={`frame ${styles.splitMedia} reveal`}>
            <Photo slug="celebration-crowd" sizes="(min-width: 960px) 46vw, 100vw" />
          </div>
          <div className={`${styles.splitBody} reveal`}>
            <p className="eyebrow">Celebrations</p>
            <h2 id="celebrate-title" className="h2">
              Make the day legendary.
            </h2>
            <p className="lede">
              Birthdays, bachelor and bachelorette parties, matric results, a promotion: the people who come to watch remember it as much as the people who
              jump.
            </p>
            <ul role="list" className={styles.checks}>
              <li>
                <Check /> Six or more jumpers get the group rate automatically
              </li>
              <li>
                <Check /> Friends who don’t jump can ride the lift to the viewing platform
              </li>
              <li>
                <Check /> Every jumper gets a Scream Clip to share in the group chat
              </li>
              <li>
                <Check /> Birthday cake is welcome. Lunch at Chaf-Pozi, on site
              </li>
            </ul>
            <Link href="/book" className="btn btn--dark">
              Book for your group
            </Link>
          </div>
        </div>
      </section>

      <section id="teams" className={`section ${styles.deep}`} aria-labelledby="teams-title">
        <div className={`container ${styles.split} ${styles.splitCenter} ${styles.reverse}`}>
          <div className={`frame ${styles.splitMedia} reveal`}>
            <Photo slug="paintball-arena" sizes="(min-width: 960px) 46vw, 100vw" />
          </div>
          <div className={`${styles.splitBody} reveal`}>
            <p className="eyebrow">Corporate teams</p>
            <h2 id="teams-title" className="h2">
              A shared memory at 100m.
            </h2>
            <p className="lede">
              Team days run on Thursdays and Fridays, when the towers are at their quietest. We build the day around your group and your budget.
            </p>
            <ul role="list" className={styles.checks}>
              <li>
                <Check /> Bungee, SCAD freefall, paintball and the lift ride, mixed to suit the team
              </li>
              <li>
                <Check /> Birthday cake is welcome. Lunch at Chaf-Pozi, on site
              </li>
              <li>
                <Check /> Paid upfront, with a quote and invoice for your finance team
              </li>
              <li>
                <Check /> Not everyone has to jump: there’s a role for every comfort level
              </li>
            </ul>
            <a href="#enquire" className="btn btn--dark">
              Ask for a quote
            </a>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="more-groups-title">
        <div className="container">
          <h2 id="more-groups-title" className="visually-hidden">
            Schools and travel groups
          </h2>
          <div className="grid grid--2">
            <article id="schools" className="card reveal">
              <Users width={32} height={32} />
              <p className="eyebrow">Schools & youth</p>
              <h3 className="h3">A safe outing that teaches something</h3>
              <p className="muted">
                Learners 12 and older can ride the lift to the viewing platform for a 360° view over Soweto, from the towers of a power station that supplied
                Johannesburg from 1942 to 1998. Learners who jump need signed parent or guardian consent.
              </p>
              <ul role="list" className={styles.checks}>
                <li>
                  <Check /> No children under 12 at the top of the tower
                </li>
                <li>
                  <Check /> Under-18s need signed consent from a parent or guardian
                </li>
                <li>
                  <Check /> Group visits on Thursdays and Fridays, paid upfront
                </li>
              </ul>
              <a href="#enquire" className="link-arrow">
                Plan a school visit <ArrowUpRight />
              </a>
            </article>
            <article id="travel" className="card card--dark reveal" style={{ ['--delay' as string]: '80ms' }}>
              <Calendar width={32} height={32} />
              <p className="eyebrow">Tour operators & hotels</p>
              <h3 className="h3">Sell Soweto from the top</h3>
              <p className="muted">
                Bring your guests to one of Soweto’s best-known landmarks. Tour operators get commission and priority slots; hotels and backpackers get
                concierge voucher packs and a referral code.
              </p>
              <ul role="list" className={styles.checks}>
                <li>
                  <Check /> Your own tracked partner link and code
                </li>
                <li>
                  <Check /> Timed slots that fit a tour itinerary
                </li>
              </ul>
              <Link href="/partners" className="link-arrow" style={{ color: 'var(--on-dark)' }}>
                Partner with us <ArrowUpRight />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section id="enquire" className="section" aria-labelledby="enquire-title">
        <div className={`container ${styles.split}`}>
          <div className={`${styles.splitBody} ${styles.sticky}`}>
            <Spark width={32} height={32} />
            <p className="eyebrow">Plan a group day</p>
            <h2 id="enquire-title" className="h2">
              Tell us your numbers.
            </h2>
            <p className="lede">Groups of 15 or more, team days, schools and tours: send the details and the crew comes back with a plan and a quote.</p>
            <p className="muted small">Smaller group? Book online and the group rate applies from six jumpers.</p>
          </div>
          <div className="card">
            <EnquiryForm
              types={['group', 'corporate', 'school', 'tour_operator', 'hotel']}
              dateHint="We’re open Thursday to Sunday. Groups do best on Thursdays and Fridays, when the towers are quietest."
              page="/groups"
              messagePlaceholder="What are you celebrating or planning? Which adventures? Lunch on site?"
            />
          </div>
        </div>
      </section>

      {groupFaqs.length > 0 ? (
        <section className="section section--tight" aria-labelledby="gfaq-title">
          <div className="container">
            <SectionHead eyebrow="Questions" title="Group questions." id="gfaq-title" />
            <FaqList items={groupFaqs} name="group-faq" />
          </div>
        </section>
      ) : null}

      <CtaBand
        headingId="groups-cta"
        image="towers-mural-hero"
        eyebrow="Six or more?"
        title="The group rate is automatic."
        text="Book a timed slot for your whole group online and the discount applies at checkout."
        label="Book for your group"
      />
    </>
  );
}
