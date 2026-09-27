import { SectionHeading } from '../components/ui/SectionHeading';
import { site } from '../data/site';
import { useTitle } from '../lib/useTitle';

/**
 * Privacy notice, structured around what POPIA (Protection of Personal
 * Information Act, 2013) asks a responsible party to tell people. It
 * describes only what this website actually collects and does.
 *
 * TEMPLATE — must be reviewed by the studio before launch. Items in
 * [square brackets] are facts only Grateful can supply.
 */

const sections: { title: string; body: string[] }[] = [
  {
    title: 'Who we are',
    body: [
      `${site.legalName} (“Grateful”, “we”) is the responsible party for personal information collected through this website. Contact: ${site.email}, ${site.location}.`,
      'Information Officer: [name of the Information Officer, as registered with the Information Regulator].',
    ],
  },
  {
    title: 'What we collect',
    body: [
      'When you book: your name, email address, phone number, the service, date and time you choose, and any project notes you add.',
      'When you pay: the amount, the payment status and the payment reference from our payment provider. We never see or store your card details — payment is entered on the payment provider’s own secure page.',
      'When you send an enquiry: your name, email address, optional phone number, the service you are interested in and your message.',
      'When you join our newsletter: your email address and your consent.',
    ],
  },
  {
    title: 'Why we use it',
    body: [
      'To schedule, confirm, reschedule and remind you about appointments, and to reply to enquiries — processing needed to provide the service you asked for.',
      'To take and verify payments and keep financial records, as the law requires.',
      'To send newsletter emails, only if you have opted in. You can unsubscribe with the link in any newsletter email.',
    ],
  },
  {
    title: 'Who we share it with',
    body: [
      'Only the service providers that run this website for us, each bound to protect it: our database host (Supabase), our payment provider (PayFast), our email provider (Resend) and our web host (Vercel). Some of these store data outside South Africa, with safeguards the Act requires. [Confirm providers and hosting regions before launch.]',
      'We do not sell your information or share it for anyone else’s marketing.',
    ],
  },
  {
    title: 'How long we keep it',
    body: ['[Booking and payment records: e.g. five years, for tax purposes. Enquiries: e.g. twelve months. Newsletter: until you unsubscribe.]'],
  },
  {
    title: 'Your rights',
    body: [
      'You may ask what personal information we hold about you, ask us to correct or delete it, and object to its use for marketing. Email us at the address above.',
      'If you are unhappy with how we handle your information, you may complain to the Information Regulator (South Africa): inforeg.org.za.',
    ],
  },
  {
    title: 'Cookies',
    body: ['This website does not use advertising or tracking cookies. It keeps your booking progress in your own browser (session storage) so a refresh does not lose it.'],
  },
];

export default function Privacy() {
  useTitle('Privacy', 'How Grateful collects, uses and protects personal information, under POPIA.');
  return (
    <article className="page-gutter pt-32 pb-24 lg:pt-44">
      <SectionHeading as="h1" size="lg" eyebrow="(Privacy)" lines={['Your', <span className="editorial-italic">information.</span>]} />
      <p className="mt-8 max-w-2xl text-lg opacity-80">This notice explains what personal information this website collects, why, and what you can ask us to do with it.</p>
      <p className="ui-label mt-4 opacity-60">Last updated: [date]</p>
      <div className="mt-16 max-w-3xl divide-y divide-white/15 border-y border-line">
        {sections.map((s) => (
          <section key={s.title} className="grid gap-4 py-10 md:grid-cols-3">
            <h2 className="font-serif text-2xl italic">{s.title}</h2>
            <div className="space-y-4 leading-relaxed opacity-85 md:col-span-2">
              {s.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
