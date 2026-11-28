import type { Metadata } from 'next';
import { LegalDoc } from '@/components/content/LegalDoc';
import { activities } from '@/content/catalog';
import { site } from '@/content/site';
import { rand } from '@/lib/format';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Terms & Conditions',
  description: 'Booking, payment, weather, voucher and conduct terms for visits and activities at Soweto Towers (Orlando Towers), Soweto.',
  path: '/legal/terms',
  noindex: false,
});

const paintball = activities.find((a) => a.id === 'paintball')!;
const leadHours = paintball.booking.mode === 'session' ? paintball.booking.leadHours : 24;

export default function TermsPage() {
  return (
    <LegalDoc
      name="Terms"
      path="/legal/terms"
      title="Terms & conditions"
      lede="The rules that keep bookings fair and visits safe. Plain language where we can, detail where it matters."
      updated="28 November 2026"
      sections={[
        {
          heading: 'Who we are',
          paragraphs: [
            `${site.name} operates the adventure centre on the towers at ${site.address.street}, ${site.address.suburb}, ${site.address.city}. These terms apply to bookings, gift vouchers and visits made on this website, by WhatsApp or on site. By booking or taking part you accept them, together with our indemnity and privacy policy.`,
          ],
        },
        {
          heading: 'Bookings and timed slots',
          list: [
            'You book a date and a timed slot for each activity. Prices are per person, per activity: one booking of a bungee jump is one jump.',
            'Group rates apply automatically when enough people are booked on the same activity in one booking.',
            'Your booking is confirmed when payment succeeds. We send your ticket by email and, if you choose, WhatsApp.',
            'Please arrive about 20 minutes before your slot. If you arrive late we will try to fit you in later that day, but we can’t guarantee it.',
            'Part of every hour is kept for walk-ins. Booked slots go first.',
          ],
        },
        {
          heading: 'Prices and payment',
          list: [
            'Prices are shown in South African rand on this website and are the prices you pay for each activity.',
            `Entrance to the site is ${rand(site.entranceFee)} per person, paid at the gate.`,
            'Online payments are processed by our payment provider. We never see or store your full card details.',
            'The site is cash-free for the safety of guests and staff: please pay by card.',
          ],
        },
        {
          heading: 'Safety requirements',
          paragraphs: [
            'Each activity has weight, age and health requirements, shown on its page and checked during booking. You must give accurate information for everyone in your booking.',
          ],
          list: [
            'The crew weighs participants again on site and may refuse anyone outside the limits, anyone who appears to be under the influence of alcohol or drugs, or anyone they believe is at risk.',
            'Nobody under 12 goes up the tower. Participants under 18 need a parent or guardian’s signed consent.',
            'Tandem jumps are not allowed.',
            'The crew’s safety decisions on the day are final.',
          ],
          after: [
            'If a participant is refused because the information given at booking was inaccurate, the booking may not be refundable. [Refund rule to be confirmed by Soweto Towers.]',
          ],
        },
        {
          heading: 'Weather',
          paragraphs: [
            'We stop all activities when it rains and when our lightning detectors warn of a storm, and restart when it is safe. If weather stops activities during your booked slot, you can move your booking to another open day free of charge.',
          ],
        },
        {
          heading: 'Changes and cancellations',
          list: [
            'To move a booking, contact us on WhatsApp or email with your booking reference at least 24 hours before your slot.',
            `Paintball: book at least ${leadHours} hours ahead. Bookings apply to the date and time chosen; no-shows forfeit payment, and there are no refunds or vouchers for players who cancel, don’t arrive or choose not to take part.`,
            'Refunds for other cancellations: [policy to be confirmed by Soweto Towers].',
          ],
          after: ['Nothing in these terms limits your rights under the Consumer Protection Act, 2008.'],
        },
        {
          heading: 'Gift vouchers',
          list: [
            'Gift a Jump vouchers are valid for 365 days from the date of issue.',
            'Redeem a voucher by entering its code when you book. If the voucher is worth more than your booking, the balance stays on the code until it expires.',
            'Vouchers can’t be exchanged for cash.',
          ],
        },
        {
          heading: 'Photos, video and your own cameras',
          list: [
            'Our multimedia crew films bungee and SCAD jumps. Free Scream Clips and paid videos are sent to the details you booked with.',
            'For safety, you may not take your own cameras or phones onto the bridge or into the tower.',
            'We only repost your clip on our channels if you ticked the consent box when booking.',
          ],
        },
        {
          heading: 'On site',
          list: [
            'Follow the crew’s instructions at all times.',
            'Outside catering and braais are not allowed. Chaf-Pozi restaurant serves food and drinks on site.',
            'Birthday cakes are welcome. Please leave the site as clean as you found it.',
          ],
        },
        {
          heading: 'Contact',
          paragraphs: [`Questions about these terms: ${site.email} or ${site.phone.display}.`],
        },
      ]}
    />
  );
}
