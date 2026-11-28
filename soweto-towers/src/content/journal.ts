import { activities, addons, getPackage } from './catalog';
import type { ImageSlug } from './images';
import { site } from './site';

/**
 * Journal articles ("From the Top" stories and visitor guides). Prices, limits
 * and hours are read from the catalog and site config so articles never go
 * stale. Facts about third-party landmarks are kept to widely documented ones.
 */

export type Article = {
  slug: string;
  title: string;
  description: string;
  published: string; // YYYY-MM-DD
  image: ImageSlug;
  readMinutes: number;
  body: { type: 'p' | 'h2' | 'ul'; text?: string; items?: string[] }[];
};

const act = (id: string) => activities.find((a) => a.id === id)!;
const R = (n: number) => `R${n.toLocaleString('en-US')}`;

const bungee = act('bungee-jump');
const straightjacket = act('straightjacket-bungee');
const scad = act('scad-freefall');
const zipline = act('zipline');
const paintball = act('paintball');
const lift = act('lift-ride');
const base = act('base-jump');
const jumpFilm = getPackage('jump-film')!;
const fullTower = getPackage('full-tower')!;
const thursday = site.weeklyOpening[4];
const friday = site.weeklyOpening[5];

export const articles: Article[] = [
  {
    slug: 'soweto-towers-or-orlando-towers',
    title: 'Soweto Towers or Orlando Towers? One landmark, two names',
    description: 'Why the painted cooling towers in Orlando East go by two names, where they came from, and what you can do at the top today.',
    published: '2026-11-28',
    image: 'towers-mural-hero',
    readMinutes: 4,
    body: [
      {
        type: 'p',
        text: 'Search for a bungee jump in Johannesburg and you will meet two names. Maps, travel guides and tour operators often say Orlando Towers. The adventure centre on top says Soweto Towers. Both point to the same place: two painted cooling towers on the corner of Sheffield Road and Chris Hani Road in Orlando East, Soweto, with a suspension bridge strung between them.',
      },
      {
        type: 'p',
        text: 'If you have ever been unsure which name to type, or which website is the right one, this short guide clears it up.',
      },
      { type: 'h2', text: 'Why “Orlando”?' },
      {
        type: 'p',
        text: 'The towers were built for the Orlando Power Station, which supplied electricity to Johannesburg from 1942 until it was decommissioned in 1998. The two cooling towers went up in 1951 to add cooling capacity to the station. They stand in Orlando, the part of Soweto the power station was named after, so for decades people simply called them the Orlando Towers.',
      },
      {
        type: 'p',
        text: 'The power station has long been switched off, but the towers stayed. Today they are among the most recognisable shapes on the Soweto skyline, painted from top to bottom with murals that celebrate Soweto.',
      },
      { type: 'h2', text: 'Why “Soweto Towers”?' },
      {
        type: 'p',
        text: 'The adventure centre that runs the bungee jumps, SCAD freefalls and lift rides on the towers trades as Soweto Towers. The name puts the whole township on the sign, and it says plainly where you are going: Soweto, and up.',
      },
      {
        type: 'p',
        text: 'It is also the idea behind our line, “Soweto, from the top.” You can jump from the top, see Soweto from the top, or simply stand on the viewing platform and feel what it is like to have the township spread out beneath you in every direction.',
      },
      { type: 'h2', text: 'Two names, one official site' },
      {
        type: 'p',
        text: 'Whichever name you search, you should end up here. Both names appear in our page titles and across this site, so someone looking for “Orlando Towers bungee” and someone looking for “Soweto Towers” land on the same booking page, with the same prices and the same timed slots.',
      },
      { type: 'p', text: 'A few things are always true on the official site:' },
      {
        type: 'ul',
        items: [
          `Prices are listed up front. The ${bungee.name.toLowerCase()} is ${R(bungee.price)} per person, or ${R(bungee.group!.price)} each for groups of ${bungee.group!.min} or more.`,
          'You book a timed slot and pay online, then show the QR code on your ticket at the gate.',
          `Entrance is ${R(site.entranceFee)} per person at the gate. The site is cash-free, so please pay by card.`,
          'Your ticket, weather updates and your Scream Clip come to the WhatsApp number you book with.',
        ],
      },
      {
        type: 'p',
        text: 'If anyone asks you to pay for a jump in cash, or quotes prices very different from the ones on this site, check with us on WhatsApp before you pay.',
      },
      { type: 'h2', text: 'What you can do on the towers today' },
      {
        type: 'ul',
        items: [
          `${bungee.name}: 100m from the bridge between the towers, ${R(bungee.price)}.`,
          `${straightjacket.name}: the same drop with your arms strapped in, ${R(straightjacket.price)} with video included.`,
          `${scad.name}: a freefall onto a catch net inside the Western Cooling Tower, ${R(scad.price)} with video included.`,
          `${zipline.name}: 700m across the Orlando Dam with a free ride back, ${R(zipline.price)}.`,
          `${paintball.name}: an hour-long game in an arena at the base of the tower, ${R(paintball.price)} per player.`,
          `${lift.name}: up the outside of the tower to a 360° view, ${R(lift.price)}.`,
          `${base.name}: for experienced skydivers with more than 100 freefalls, by arrangement.`,
        ],
      },
      { type: 'h2', text: 'When to come' },
      {
        type: 'p',
        text: `The towers open on Thursdays from ${thursday} and on Fridays to Sundays from ${friday}, and close at sunset. Monday to Wednesday they are closed. Thursday is usually the quietest day, which makes it a good choice for groups and for first-timers who would rather not have an audience.`,
      },
      {
        type: 'p',
        text: 'The status strip at the top of every page on this site shows whether the towers are open right now, today’s sunset time and any weather hold.',
      },
      { type: 'h2', text: 'The short version' },
      {
        type: 'p',
        text: 'Orlando Towers and Soweto Towers are the same landmark. Orlando is the neighbourhood and the power station that built them; Soweto Towers is the adventure centre on top. Book on this site, and we will see you on the bridge.',
      },
    ],
  },
  {
    slug: 'first-bungee-jump-what-happens',
    title: 'Your first bungee jump at the towers: what actually happens',
    description: 'From booking to the bridge to the clip on your phone: a step-by-step guide to a first 100m bungee jump at Soweto Towers.',
    published: '2026-11-28',
    image: 'before-the-drop',
    readMinutes: 5,
    body: [
      {
        type: 'p',
        text: 'You don’t have to be an adrenaline junkie to jump at the towers. People come to mark the end of exams, for a friend’s birthday, on a team day, or because they have been saying “one day” for years. If you are nervous, you are in good company. That is normal, and it is the point.',
      },
      { type: 'p', text: 'Here is what a first jump looks like, step by step, so the only surprise is the drop itself.' },
      { type: 'h2', text: '1. Book a slot and do the safety check' },
      {
        type: 'p',
        text: `You choose a date and a timed slot online. Before you pay, we ask for each jumper’s weight and a few safety questions. The bungee is for people from ${bungee.rules.minWeightKg} to ${bungee.rules.maxWeightKg} kg, nobody under ${bungee.rules.minAge} goes up the tower, and anyone under 18 needs signed consent from a parent or guardian.`,
      },
      {
        type: 'p',
        text: 'We also ask you to confirm that nobody jumping has a condition that rules it out, such as severe asthma, epilepsy, a heart or breathing disorder, high blood pressure, joint or ligament problems, or pregnancy. If you are unsure, ask the crew before you book rather than on the day.',
      },
      {
        type: 'p',
        text: 'Booking ahead is not compulsory, because part of every hour stays open for walk-ins, but a booked slot means no guesswork on a busy weekend.',
      },
      { type: 'h2', text: '2. Dress for it' },
      {
        type: 'ul',
        items: [
          'Comfortable clothes you can move in. Skip the skirt.',
          'Closed shoes that will stay on.',
          'Sunscreen: the bridge is exposed.',
          'A bank card: the site is cash-free.',
        ],
      },
      {
        type: 'p',
        text: 'Leave the GoPro at home. For safety we don’t allow loose equipment on the bridge, but every jumper gets a free 10-second Scream Clip, and our multimedia crew can film the whole jump in HD.',
      },
      { type: 'h2', text: '3. Arrive early' },
      {
        type: 'p',
        text: `Aim to arrive about 20 minutes before your slot. Pay the ${R(site.entranceFee)} entrance at the gate, have the QR code on your ticket ready, and the crew takes it from there. Friends who come to watch can cheer from the ground or ride the lift to the viewing platform for ${R(lift.price)}.`,
      },
      { type: 'h2', text: '4. Weight check and harness' },
      {
        type: 'p',
        text: 'Your weight is checked again on site so the crew can set you up correctly. Your jump master fits your harness and ankle straps and checks every buckle and carabiner before you go anywhere near the edge. This is the moment to ask questions. There are no silly ones.',
      },
      { type: 'h2', text: '5. The bridge' },
      {
        type: 'p',
        text: 'Then it is up to the suspension bridge strung between the two towers, 100 metres above the ground. It is always one jumper at a time: tandem jumps are not allowed. Your jump master talks you through exactly what happens next, and you step out to the edge when you are ready.',
      },
      {
        type: 'p',
        text: 'People handle this moment in different ways. Some count down out loud, some go quiet, some laugh. One thing that helps: look out at the horizon rather than down at your feet.',
      },
      { type: 'h2', text: '6. The drop' },
      {
        type: 'p',
        text: 'You step off, and for a few seconds Soweto rushes up to meet you. Then the cord takes over, you bounce, and the scream usually turns into a laugh somewhere around the second rebound. When the cord settles, the crew brings you safely back down.',
      },
      { type: 'h2', text: '7. If the weather turns' },
      {
        type: 'p',
        text: 'We stop all activities when it starts to rain, and start again as soon as it clears and the crew has re-rigged. The towers have lightning detectors: if the alarm sounds, everyone at the top is brought down straight away. If weather stops jumps during your booked slot, you can move it for free.',
      },
      { type: 'h2', text: '8. The clip' },
      {
        type: 'p',
        text: `Every jumper gets a free 10-second Scream Clip on the WhatsApp number they booked with. If you want the whole jump, the full HD video is ${R(addons.video.price)}, or book ${jumpFilm.name} at ${R(jumpFilm.price)} and it is included. Your clips also wait for you on Find my jump, using your booking reference.`,
      },
      { type: 'h2', text: 'Want more?' },
      {
        type: 'p',
        text: `If one jump isn’t enough, the ${straightjacket.name.toLowerCase()} straps your arms to your body for the same 100m drop, and the ${scad.name} drops you onto a catch net inside the Western Cooling Tower with no cord at all. ${fullTower.name} combines the bungee, the SCAD freefall with video and the full bungee video for ${R(fullTower.price)}.`,
      },
      { type: 'p', text: 'Welcome to the #100mClub.' },
    ],
  },
  {
    slug: 'a-day-in-soweto-around-the-towers',
    title: 'A day in Soweto, planned around the towers',
    description: 'How to build a day in Soweto around a jump or a lift ride at the towers, with the landmarks worth adding before and after.',
    published: '2026-11-28',
    image: 'soweto-street-tour',
    readMinutes: 5,
    body: [
      {
        type: 'p',
        text: 'The towers are one of the most visible landmarks in Soweto, but few visitors come for the towers alone. Soweto is big, and some of South Africa’s most important places are a short drive away. Here is one way to plan a full day around a jump, a freefall or a lift ride.',
      },
      { type: 'h2', text: 'Pick the right day' },
      {
        type: 'p',
        text: `The towers open on Thursdays from ${thursday} and on Fridays to Sundays from ${friday}, closing at sunset, and they are closed Monday to Wednesday. Plan your Soweto day for Thursday to Sunday, and check the opening times of every other stop before you set out.`,
      },
      { type: 'h2', text: 'Morning: Orlando West' },
      {
        type: 'p',
        text: 'Start on Vilakazi Street in Orlando West, the street where both Nelson Mandela and Archbishop Desmond Tutu once lived. Mandela’s former home on the street is now a museum.',
      },
      {
        type: 'p',
        text: 'Nearby, the Hector Pieterson Memorial and Museum remembers the students of the 16 June 1976 uprising and the day Soweto changed the course of South Africa’s history. Give yourself time here. It is a place to slow down.',
      },
      { type: 'h2', text: 'Midday: up the towers' },
      {
        type: 'p',
        text: 'Head to the towers on the corner of Sheffield Road and Chris Hani Road in Orlando East. Book a timed slot online so your jump fits your plan rather than the queue. Choose your height:',
      },
      {
        type: 'ul',
        items: [
          `${bungee.name}: 100m from the bridge between the towers, ${R(bungee.price)}.`,
          `${scad.name}: freefall onto a catch net inside the Western Cooling Tower, ${R(scad.price)}.`,
          `${zipline.name}: 700m across the Orlando Dam, ${R(zipline.price)}.`,
          `${lift.name}: no jump, just the 360° view, ${R(lift.price)}.`,
          `${paintball.name}: for groups of ${paintball.booking.mode === 'session' ? `${paintball.booking.minGroup} to ${paintball.booking.maxGroup}` : 'two or more'}, booked at least a day ahead.`,
        ],
      },
      {
        type: 'p',
        text: 'Friends who would rather not jump can ride the lift to the viewing platform and watch from the top, or stay on the ground with the camera.',
      },
      { type: 'h2', text: 'Lunch: shisanyama at the foot of the towers' },
      {
        type: 'p',
        text: 'Chaf-Pozi, the restaurant on site, serves shisanyama: boerewors, braaied chicken, pap and chakalaka. Add lunch when you book your jump and we will ask them to hold a table for after your slot. Save the drinks for after the jump: nobody goes up under the influence.',
      },
      { type: 'h2', text: 'Afternoon: churches and stadiums' },
      {
        type: 'p',
        text: 'Regina Mundi Church in Rockville was a gathering place during the struggle against apartheid, and it remains one of Soweto’s best-known buildings.',
      },
      {
        type: 'p',
        text: 'Football fans can add the stadiums. FNB Stadium, also known as Soccer City, hosted the final of the 2010 FIFA World Cup. Orlando Stadium, home of Orlando Pirates, is right here in Orlando.',
      },
      { type: 'h2', text: 'Sunset: back to the top' },
      {
        type: 'p',
        text: 'The towers close at sunset, and the last slots of the day are the golden ones. If you can, book a late-afternoon jump or lift ride and watch the light turn gold over Soweto. The status strip at the top of every page on this site shows today’s sunset time.',
      },
      { type: 'h2', text: 'Getting around' },
      {
        type: 'p',
        text: 'Soweto is spread out, so most visitors use a car, a ride-hailing app or a local guide. A guided tour is a good way to hear the stories behind the places, not just see them. If you run tours, our partner programme gives your guests priority slots and you a tracked partner code.',
      },
      { type: 'h2', text: 'Before you go' },
      {
        type: 'ul',
        items: [
          'Wear closed shoes and comfortable clothes if you plan to jump.',
          'Bring sunscreen and a bank card: the towers are cash-free.',
          `Entrance at the towers is ${R(site.entranceFee)} per person.`,
          'Check opening times for each stop before you set out.',
        ],
      },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}
