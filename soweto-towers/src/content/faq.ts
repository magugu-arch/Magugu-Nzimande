import { site } from './site';

/**
 * Carried over from the current FAQ and product pages, rewritten in the brand
 * voice. Where the old site disagreed with itself (video at R170 and R150), the
 * shop price is used: R170. CONFIRM in README.
 */
export type Faq = { q: string; a: string; group: 'Booking' | 'On the day' | 'Safety' | 'Groups' | 'Media' };

export const faqs: Faq[] = [
  {
    group: 'Booking',
    q: 'Do I need to book?',
    a: 'Booking a timed slot online guarantees your place and skips the queue. Part of every hour stays open for walk-ins, so you can still just arrive, but on busy weekends booked jumpers go first. Paintball must be booked at least 24 hours ahead.',
  },
  {
    group: 'Booking',
    q: 'How many jumps does the price include?',
    a: 'One. Each price is per person, per activity: one bungee jump or one SCAD freefall. Packages like Jump + Film and The Full Tower bundle activities and video at a saving.',
  },
  {
    group: 'Booking',
    q: 'When are you open?',
    a: 'Thursday 12:00 till sunset, and Friday to Sunday 10:00 till sunset. We are closed Monday to Wednesday. The status strip at the top of every page shows today’s sunset and any weather hold.',
  },
  {
    group: 'Booking',
    q: 'Can I move or cancel my booking?',
    a: 'If rain or lightning stops jumps during your slot, you can move it to another day for free. For other changes, WhatsApp us with your booking reference at least 24 hours before your slot. Paintball bookings are for the date and time chosen: no-shows forfeit payment.',
  },
  {
    group: 'Booking',
    q: 'Do you sell gift vouchers?',
    a: 'Yes. Gift a Jump vouchers are valid for 365 days and arrive by WhatsApp or email, or you can print them. The recipient enters the code when they book a timed slot.',
  },
  {
    group: 'Booking',
    q: 'Is there an entrance fee?',
    a: `Yes, R${site.entranceFee} per person at the gate. The site is cash-free for everyone’s safety, so please pay by card.`,
  },
  {
    group: 'Safety',
    q: 'Are there age or weight limits?',
    a: 'Bungee and straightjacket jumps are for 35–110 kg, and SCAD freefall for 35–100 kg. Nobody under 12 goes up the tower, and under-18s need signed consent from a parent or guardian. Paintball players must be 12 or older.',
  },
  {
    group: 'Safety',
    q: 'Can we jump together (tandem)?',
    a: 'No. Tandem jumps cause injuries, so it is always one jumper at a time.',
  },
  {
    group: 'Safety',
    q: 'Who shouldn’t jump?',
    a: 'Please don’t take part if you have severe asthma, epilepsy, a cardio or respiratory disorder, hypertension, skeletal weakness or joint or ligament problems, are pregnant, are under the influence of alcohol or drugs, or have any other condition that should stop you.',
  },
  {
    group: 'Safety',
    q: 'What happens if it rains?',
    a: 'We stop all activities when rain starts. As soon as it stops, the crew re-rigs and we carry on. The towers have lightning detectors: if the alarm sounds, everyone at the top is brought down straight away.',
  },
  {
    group: 'Safety',
    q: 'What’s the difference between the bungee and the straightjacket bungee?',
    a: 'Same 100m drop, but for the straightjacket jump we strap your arms tightly to your body. It is more intense, and preparation takes the crew longer.',
  },
  {
    group: 'On the day',
    q: 'What should I wear and bring?',
    a: 'Comfortable clothes you can jump in (preferably not a skirt), closed shoes and sunscreen. Arrive about 20 minutes before your slot with your ticket on your phone.',
  },
  {
    group: 'On the day',
    q: 'Can we bring food, drinks or a braai?',
    a: 'We don’t allow outside catering or braais, but Chaf-Pozi restaurant is on site for drinks, lunch and dinner. Birthday cake is welcome: just leave the site as clean as you found it.',
  },
  {
    group: 'On the day',
    q: 'How do I get there?',
    a: `We’re on the corner of Sheffield Road and Chris Hani Road, Orlando East, Soweto. Search “Soweto Towers” in Google Maps, Apple Maps or Waze.`,
  },
  {
    group: 'Media',
    q: 'Can I film with my own GoPro or phone?',
    a: 'Not on the bridge or in the tower: we can’t take responsibility for loose equipment at height. Instead, every jumper gets a free 10-second Scream Clip, and our multimedia crew can film the whole jump in HD.',
  },
  {
    group: 'Media',
    q: 'How much are videos and photos?',
    a: 'The full HD video is R170 and the photo pack R100, per person per activity. Video is already included with SCAD freefall and the straightjacket bungee. Jump + Film bundles the bungee and the video for R760.',
  },
  {
    group: 'Media',
    q: 'How do I get my Scream Clip?',
    a: 'It arrives on the WhatsApp number you booked with, and it is waiting on Find my jump with your booking reference.',
  },
  {
    group: 'Groups',
    q: 'Do you offer group discounts?',
    a: 'Groups of 6 or more pay R580 each for the bungee (R50 off) and R360 each for SCAD (R40 off), applied automatically when you book. Lift rides are R70 each for 10 or more.',
  },
  {
    group: 'Groups',
    q: 'Can we book a team-building day or school visit?',
    a: 'Yes. Group days run on Thursdays and Fridays and are paid upfront, with invoicing for companies. For 15 or more people, send us your numbers on the Groups page and we will put a day together.',
  },
  {
    group: 'Groups',
    q: 'Can I take part in base jumping?',
    a: 'Only if you are a skydiver with more than 100 freefalls. Every applicant is screened by our base jump co-ordinator: apply on the Base Jump page.',
  },
];

export const homeFaqs = [faqs[0]!, faqs[6]!, faqs[3]!, faqs[15]!];
