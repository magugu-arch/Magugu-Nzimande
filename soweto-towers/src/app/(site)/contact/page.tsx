import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/content/content.module.css';
import { EnquiryForm } from '@/components/forms/EnquiryForm';
import { PageHero } from '@/components/site/PageHero';
import { ArrowUpRight, FacebookGlyph, InstagramGlyph, Mail, Phone, Pin, TikTokGlyph, WhatsAppGlyph, YouTubeGlyph } from '@/components/ui/icons';
import { directions, site, whatsappLink } from '@/content/site';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Contact Us',
  description: `Call, WhatsApp or email Soweto Towers (Orlando Towers): ${site.phone.display}, ${site.email}. ${site.address.street}, ${site.address.suburb}, Soweto. Venue hire and film shoots welcome.`,
  path: '/contact',
  image: '/og/contact.jpg',
});

export default function ContactPage() {
  const socials = [
    { href: site.socials.instagram, label: 'Instagram', Icon: InstagramGlyph },
    { href: site.socials.tiktok, label: 'TikTok', Icon: TikTokGlyph },
    { href: site.socials.facebook, label: 'Facebook', Icon: FacebookGlyph },
    { href: site.socials.youtube, label: 'YouTube', Icon: YouTubeGlyph },
  ].filter((s) => s.href);

  return (
    <>
      <PageHero
        crumbs={[{ name: 'Contact', path: '/contact' }]}
        eyebrow="Contact"
        title="Talk to the crew."
        lede="Quickest on WhatsApp. Real people on site, Thursday to Sunday."
        actions={
          <a href={whatsappLink('Hi Soweto Towers! ')} className="btn btn--primary btn--lg" target="_blank" rel="noopener">
            <WhatsAppGlyph size={18} /> WhatsApp us
          </a>
        }
      />

      <section className="section section--tight" aria-label="Ways to reach us">
        <div className="container">
          <div className="grid grid--3">
            <div className={`card ${styles.contactCard}`}>
              <Phone width={30} height={30} />
              <h2 className="h3">Call</h2>
              <a href={`tel:${site.phone.e164}`} className={styles.bigLink}>
                {site.phone.display}
              </a>
              <p className="muted small">{site.phone.note}</p>
              <a href={`tel:${site.phoneAlt.e164}`} className={styles.bigLink}>
                {site.phoneAlt.display}
              </a>
              <p className="muted small">{site.phoneAlt.note}</p>
            </div>
            <div className={`card ${styles.contactCard}`}>
              <Mail width={30} height={30} />
              <h2 className="h3">Email</h2>
              <a href={`mailto:${site.email}`}>{site.email}</a>
              <p className="muted small">Bookings, groups and general questions.</p>
              <a href={`mailto:${site.emailVenue}`}>{site.emailVenue}</a>
              <p className="muted small">Film shoots, photography, location and venue hire.</p>
            </div>
            <div className={`card card--dark ${styles.contactCard}`}>
              <Pin width={30} height={30} />
              <h2 className="h3">Visit</h2>
              <address style={{ fontStyle: 'normal' }}>
                {site.address.street}
                <br />
                {site.address.suburb}, {site.address.city}
                <br />
                {site.address.metro}, {site.address.countryName}
              </address>
              <a href={directions.google} target="_blank" rel="noopener" className="link-arrow" style={{ color: 'var(--on-dark)' }}>
                Directions <ArrowUpRight />
              </a>
              <Link href="/visit" className="link-arrow" style={{ color: 'var(--on-dark)' }}>
                Hours & planning <ArrowUpRight />
              </Link>
            </div>
          </div>
          {socials.length ? (
            <div className={`cluster ${styles.mt}`}>
              {socials.map(({ href, label, Icon }) => (
                <a key={label} href={href} className="pill pill--outline" target="_blank" rel="noopener">
                  <Icon size={18} /> {label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="section" aria-labelledby="form-title">
        <div className={`container ${styles.split}`}>
          <div className={`${styles.splitBody} ${styles.sticky}`}>
            <p className="eyebrow">Send a message</p>
            <h2 id="form-title" className="h2">
              We read every one.
            </h2>
            <p className="lede">For bookings, the fastest route is the booking page. For everything else, drop us a line here.</p>
            <Link href="/book" className="btn btn--dark">
              Book a timed slot
            </Link>
          </div>
          <div className="card">
            <EnquiryForm
              types={['general', 'venue', 'media']}
              page="/contact"
              showGroupSize={false}
              messageLabel="Your message"
              submitLabel="Send message"
              consentLabel="Soweto Towers may reply to me about this message by email, phone or WhatsApp."
            />
          </div>
        </div>
      </section>
    </>
  );
}
