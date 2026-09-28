/**
 * Legal copy: DRAFTS for Mábu's attorneys (brief §19, §38, §50). Written to
 * describe what this app actually does with personal information, so the
 * reviewed version can be dropped in without changing the screens. Every
 * page says it is a draft until `reviewed` is set.
 */
export type LegalDocId = 'privacy' | 'terms' | 'marketing';

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  reviewed: boolean;
  updated: string;
  sections: { heading: string; body: string }[];
}

const RESPONSIBLE_PARTY =
  'Mábu Restaurant, Waterfall Wilds, Waterfall City, Midrand (legal entity name and registration number to be confirmed)';

export const LEGAL: Record<LegalDocId, LegalDoc> = {
  privacy: {
    id: 'privacy',
    title: 'Privacy notice',
    reviewed: false,
    updated: '2026-09-28',
    sections: [
      {
        heading: 'Who we are',
        body: `${RESPONSIBLE_PARTY} is the responsible party for the personal information this app collects, under the Protection of Personal Information Act, 2013 (POPIA). Our information officer can be reached at reservations@maburestaurant.com.`,
      },
      {
        heading: 'What we collect',
        body: 'Your name, email address and mobile number; your bookings, visits, event tickets and gift vouchers; the preferences and occasions you choose to tell us (dietary needs, seating, accessibility, birthdays and anniversaries); your MÁBU Rewards points and redemptions; your notification choices; and, if you allow notifications, a device token so we can send them. We do not collect your location, contacts or card numbers — payments are handled by our payment provider on their own secure page.',
      },
      {
        heading: 'Why we use it',
        body: 'To take and manage your bookings, send confirmations and reminders, host you well on the night (your dietary and accessibility notes go to the team serving you), run MÁBU Rewards, issue and redeem gift vouchers, and answer you when you contact us. We rely on performing our agreement with you for these. Marketing messages are sent only with your consent, which you can withdraw at any time.',
      },
      {
        heading: 'Special personal information',
        body: 'Dietary and accessibility notes can reveal health or religious information. We ask for them only so the kitchen and floor team can look after you, show them only to staff who need them, and never use them for marketing. You can remove them from your profile at any time.',
      },
      {
        heading: 'Who we share it with',
        body: 'Our booking system provider (currently the restaurant’s own system; Dineplan if we switch to it), our payment provider, our email and push notification providers, and our hosting provider — each only for the service they provide to us and under a written agreement. We do not sell your information. Some providers may process information outside South Africa; where they do, we use providers bound by protection at least equal to POPIA.',
      },
      {
        heading: 'How long we keep it',
        body: 'Your account stays until you delete it. When you delete it, we remove your name and contact details at once; bookings and financial records are kept without them for as long as tax and accounting law requires. Unused sign-in codes expire after ten minutes.',
      },
      {
        heading: 'Your rights',
        body: 'You may ask what we hold about you, ask us to correct or delete it, object to processing, and withdraw marketing consent — in the app (Profile → Your details, and Notification preferences) or by emailing us. You may also complain to the Information Regulator (South Africa): inforeg.org.za.',
      },
      {
        heading: 'Security',
        body: 'Sign-in uses one-time codes; codes and session keys are stored only in scrambled (hashed) form. Staff access is limited by role, and sensitive staff actions are logged.',
      },
    ],
  },
  terms: {
    id: 'terms',
    title: 'Terms of use',
    reviewed: false,
    updated: '2026-09-28',
    sections: [
      {
        heading: 'Bookings',
        body: 'A booking is confirmed only when the app shows it as confirmed and you receive a confirmation. Please arrive on time, or let us know if you are running late. You can change or cancel in the app up to the cut-off shown on your booking; after that, please call or email us. Where a deposit applies, the amount and refund rule are shown before you pay.',
      },
      {
        heading: 'Events',
        body: 'Event tickets are for the date and seats shown. Menus may change with the season. Refunds for events follow the policy shown on the event before you buy.',
      },
      {
        heading: 'Gift vouchers',
        body: 'Vouchers are valid for three years from purchase (Consumer Protection Act), may be used over more than one visit until the balance is spent, and cannot be exchanged for cash. Treat a voucher code like cash: anyone holding it can use it.',
      },
      {
        heading: 'MÁBU Rewards',
        body: 'Points are earned on completed visits and eligible experiences, and have no cash value. Points expire as shown in the app. We may change the programme with notice in the app; points already earned remain yours until they expire. Misuse may lead to points being removed.',
      },
      {
        heading: 'Content and prices',
        body: 'Menus, wines, prices and photographs are for guidance and may change. Tell us about any allergy when you book; our kitchen handles common allergens and cannot guarantee a dish is free of traces.',
      },
      {
        heading: 'Liability and law',
        body: 'Nothing in these terms limits your rights under the Consumer Protection Act. These terms are governed by the law of South Africa.',
      },
    ],
  },
  marketing: {
    id: 'marketing',
    title: 'Marketing consent',
    reviewed: false,
    updated: '2026-09-28',
    sections: [
      {
        heading: 'What you agree to',
        body: 'If you choose to receive news and invitations, we may send you messages about new menus, events, experiences and MÁBU Rewards offers, by the channels you select. We send them only while you have consent switched on.',
      },
      {
        heading: 'How to stop',
        body: 'Switch it off in Notification preferences at any time, or use the unsubscribe link in any email. Booking confirmations and reminders are not marketing and continue while you have bookings with us.',
      },
      {
        heading: 'Frequency',
        body: 'We send no more than a few marketing messages a month and never during your quiet hours.',
      },
    ],
  },
};
