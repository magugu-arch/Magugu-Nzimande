import type { Metadata } from 'next';
import { LegalDoc } from '@/components/content/LegalDoc';
import { site } from '@/content/site';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Privacy Policy (POPIA)',
  description: 'How Soweto Towers (Orlando Towers) collects, uses and protects personal information under the Protection of Personal Information Act (POPIA).',
  path: '/legal/privacy',
});

export default function PrivacyPage() {
  return (
    <LegalDoc
      name="Privacy"
      path="/legal/privacy"
      title="Privacy policy"
      lede="What we collect, why we need it and how you stay in control, in line with the Protection of Personal Information Act (POPIA)."
      updated="28 November 2026"
      sections={[
        {
          heading: 'Who is responsible',
          paragraphs: [
            `${site.name}, ${site.address.street}, ${site.address.suburb}, ${site.address.city}, is the responsible party for personal information collected on this website and on site.`,
            `Information Officer: [name to be confirmed]. Contact: ${site.email}.`,
          ],
        },
        {
          heading: 'What we collect',
          list: [
            'Booking details: your name, email address and mobile number, and the first names of the people in your booking.',
            'Safety details: each participant’s weight, whether they are under 18, a parent or guardian’s name where needed, and your confirmation of the medical declaration. We don’t ask for or store details of medical conditions.',
            'Payment status and reference. Card details are handled by our payment provider and never reach us.',
            'Messages you send us through the website chat, enquiry forms, WhatsApp or email.',
            'Photos and video of your activity taken by our multimedia crew.',
            'Website data: essential cookies, and analytics or advertising data only if you allow them.',
          ],
        },
        {
          heading: 'Why we use it',
          list: [
            'To take and manage your booking, run the safety checks and check you in.',
            'To send your ticket, reminders, weather updates, your Scream Clip and any videos you bought.',
            'To answer your messages and enquiries.',
            'To meet our legal and accounting obligations.',
            'With your consent only: marketing messages, reposting your clip, and analytics and advertising cookies.',
          ],
        },
        {
          heading: 'Children',
          paragraphs: [
            'Participants under 18 can only take part with the consent of a parent or guardian, who gives that consent for the processing of the child’s information needed for the booking and the activity.',
          ],
        },
        {
          heading: 'Who we share it with',
          paragraphs: [
            'We share information only with service providers who help us run bookings, and only as much as they need: our payment provider, our website and database hosts, and the email and WhatsApp services that deliver your messages. Some of these providers may store information outside South Africa; where they do, we rely on safeguards that POPIA allows. We never sell personal information.',
          ],
        },
        {
          heading: 'How long we keep it',
          paragraphs: [
            'We keep booking records for as long as we need them for the purposes above and to meet legal and accounting requirements, and then delete or de-identify them. [Retention periods to be confirmed.] Marketing opt-ins last until you unsubscribe.',
          ],
        },
        {
          heading: 'Keeping it safe',
          paragraphs: [
            'Information travels over encrypted connections, staff access the booking system with individual accounts, and payment details stay with the payment provider.',
          ],
        },
        {
          heading: 'Cookies and analytics',
          list: [
            'Essential cookies keep your booking, chat and staff sessions working.',
            'Attribution cookies remember a partner or campaign code for 30 days so bookings can be credited correctly.',
            'Analytics and advertising tools only load if you choose “Allow all” in the cookie banner. You can change your choice by clearing this site’s data in your browser.',
          ],
        },
        {
          heading: 'Your rights',
          list: [
            'Ask what information we hold about you, and for a copy.',
            'Ask us to correct or delete it.',
            'Object to processing, and withdraw consent at any time (for example, reply STOP on WhatsApp or unsubscribe from email).',
            'Complain to the Information Regulator (South Africa) if you are unhappy with how we handled your information.',
          ],
          after: [`To use any of these rights, email ${site.email}.`],
        },
      ]}
    />
  );
}
