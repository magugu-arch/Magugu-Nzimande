/**
 * Starting events, drawn from the relaunch campaign calendar. They load into an
 * empty database so the Events page is never bare; staff edit or replace them
 * in the console. Times are SAST. CONFIRM dates and pricing with the operator.
 */
export type SeedEvent = {
  slug: string;
  title: string;
  tag: string;
  summary: string;
  body: string;
  startsAt: string;
  endsAt: string;
  image: string;
  price: number | null;
  capacity: number;
};

export const seedEvents: SeedEvent[] = [
  {
    slug: 'relaunch-weekend',
    title: 'The Relaunch Weekend',
    tag: 'Launch',
    summary: 'Three days to open the new Soweto Towers: timed jumps, the first Scream Clips and the Legends wall unveiled.',
    body: 'The towers have a new crew, a new booking system and a new promise: book your slot, skip the guesswork, and leave with your Scream Clip on WhatsApp.\n\nCome for a jump, come to watch, or ride the lift for the view. Entry to the site is free with an RSVP; adventures are booked separately at the usual prices.',
    startsAt: '2027-02-12T10:00:00+02:00',
    endsAt: '2027-02-14T18:45:00+02:00',
    image: 'towers-mural-hero',
    price: null,
    capacity: 600,
  },
  {
    slug: 'scream-of-the-week-easter',
    title: 'Scream of the Week: Easter Weekend',
    tag: 'Season one',
    summary: 'Every jump over the Easter weekend is in the running. Followers vote for the best clip, and the winner jumps again free.',
    body: 'Scream of the Week starts here. Jump over the long weekend and tick the consent box when you book, and your clip can be entered. We post the best clips, followers vote, and the winner gets a free jump.\n\nBook a timed slot to make sure you get on the bridge.',
    startsAt: '2027-03-26T10:00:00+02:00',
    endsAt: '2027-03-28T18:15:00+02:00',
    image: 'scream-clip-phone',
    price: null,
    capacity: 400,
  },
  {
    slug: 'families-from-the-top',
    title: 'Families from the Top',
    tag: 'School holidays',
    summary: 'A school-holiday Saturday for families: lift rides to the viewing platform, jumps for the brave, and a braai at Chaf-Pozi.',
    body: 'Bring the family up the tower. Learners 12 and older can ride the lift to the 360° viewing platform; older teens can jump with signed parent or guardian consent.\n\nTickets cover a lift ride and view. Book jumps and tables separately.',
    startsAt: '2027-04-24T10:00:00+02:00',
    endsAt: '2027-04-24T17:30:00+02:00',
    image: 'lift-ride-view',
    price: 80,
    capacity: 200,
  },
  {
    slug: 'team-day-at-100m',
    title: 'Team Day at 100m',
    tag: 'Corporate',
    summary: 'Thursday team days built around one shared moment: everyone on the bridge, everyone cheering from the ground.',
    body: 'Thursdays are the quietest window at the towers, which makes them ideal for teams. We plan the day around your group: jumps, SCAD, paintball, lunch at Chaf-Pozi and invoicing for HR.\n\nTell us your numbers and we will send a quote.',
    startsAt: '2027-05-13T12:00:00+02:00',
    endsAt: '2027-05-13T17:30:00+02:00',
    image: 'team-day',
    price: null,
    capacity: 120,
  },
  {
    slug: '67-minutes-at-the-dam',
    title: '67 Minutes at the Dam',
    tag: 'Mandela Day',
    summary: 'Give 67 minutes to clean up around the Orlando Dam with the crew, then see the result from the top of the tower.',
    body: 'On Mandela Day we head down to the Orlando Dam for a 67-minute clean-up with neighbours, schools and anyone who wants to help. Gloves and bags are on us.\n\nVolunteers who RSVP get a free lift ride afterwards to see the dam from the top.',
    startsAt: '2027-07-18T10:00:00+02:00',
    endsAt: '2027-07-18T13:00:00+02:00',
    image: 'zipline-orlando-dam',
    price: null,
    capacity: 300,
  },
  {
    slug: 'heritage-from-the-top',
    title: 'Heritage: Murals & Landmarks from the Top',
    tag: 'Heritage Day',
    summary: 'Ride the lift on Heritage Day and let the crew point out the murals and the Soweto landmarks you can see from the platform.',
    body: 'The towers carry some of the largest murals in Johannesburg, and the platform looks out over a century of Soweto history. On Heritage Day the crew takes small groups up for a look at both.\n\nTickets are the price of a lift ride.',
    startsAt: '2027-09-24T10:00:00+02:00',
    endsAt: '2027-09-24T17:45:00+02:00',
    image: 'soweto-dusk-panorama',
    price: 80,
    capacity: 240,
  },
];
