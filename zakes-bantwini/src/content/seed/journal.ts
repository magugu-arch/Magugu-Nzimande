import type { z } from 'zod';
import type { Story } from '../schema';

/*
 * Journal pieces written to the brief's positioning ("The Architect"). They
 * make no biographical claims, carry no attributed quotes and give no dates —
 * those come from management. Each is `pending` until signed off, and
 * `publishedAt` is set when it is.
 */
export const stories: z.input<typeof Story>[] = [
  {
    slug: 'the-room-before-the-stage',
    title: 'The room before the stage',
    category: 'live',
    standfirst: 'Every show is decided long before the lights come up — in a quiet room, with a jacket on a hanger and a table of cables.',
    hero: 'IMG_6873',
    publishedAt: null,
    approval: 'pending',
    body: [
      { type: 'p', text: 'Audiences meet the performance at its loudest. The work that shapes it happens at the other end of the volume dial: a dressing room, a running order, in-ear monitors laid out in a case, a pass on a lanyard.' },
      { type: 'p', text: 'Preparation is where a set stops being a list of songs and becomes an arc — where the opening is chosen for the room in front of it, and the close is held back until the room has earned it.' },
      { type: 'statement', text: 'The stage is the last place the show is built.' },
      { type: 'image', media: 'IMG_6866', caption: 'Rehearsal: the band runs the set while the details are settled.' },
      { type: 'p', text: 'It is also where a promise to a promoter, a festival or a private host gets kept. The booking may have taken weeks. The quiet hour beforehand is what makes it worth it.' },
    ],
  },
  {
    slug: 'what-an-archive-is-for',
    title: 'What an archive is for',
    category: 'legacy',
    standfirst: 'A catalogue is not a shelf of finished things. Kept well, it is a working library for whoever comes next.',
    hero: 'IMG_6868',
    publishedAt: null,
    approval: 'pending',
    body: [
      { type: 'p', text: 'Records, tapes, photographs, contracts, notes in the margin. An archive is the evidence of how the music was made — and the raw material for what it becomes.' },
      { type: 'p', text: 'Treated as storage, it gathers dust. Treated as an institution, it teaches: producers learn arrangement from the sessions, writers learn structure from the drafts, and the culture learns its own history from the source.' },
      { type: 'image', media: 'IMG_6879', caption: 'The tactile record: vinyl and photographs, handled rather than filed.' },
      { type: 'statement', text: 'Music was the beginning. The vision builds the legacy.' },
      { type: 'p', text: 'That is the thinking behind the Catalogue pillar of The Architect: protect the work, make it findable, and put it to use.' },
    ],
  },
  {
    slug: 'build-the-room',
    title: 'Build the room, then fill it',
    category: 'studio',
    standfirst: 'The studio is a room for other people as much as it is for the producer at the desk.',
    hero: 'IMG_6870',
    publishedAt: null,
    approval: 'pending',
    body: [
      { type: 'p', text: 'A mixing console looks like a single person’s instrument. In practice it is a meeting place: a producer, an engineer, a young artist with headphones on, each with a hand on a different fader.' },
      { type: 'p', text: 'The best sessions are built before anyone plays a note. Who is in the room, what they are listening for, how decisions get made — that is architecture too.' },
      { type: 'image', media: 'IMG_6864' },
      { type: 'p', text: 'It is why the Label and the Academy sit beside the music in The Architect’s plan. A room that makes good records should also make good record-makers.' },
    ],
  },
  {
    slug: 'a-festival-is-a-promise',
    title: 'A festival is a promise',
    category: 'culture',
    standfirst: 'Open ground at sunset, a stage dressed in timber and cloth, and a crowd that travelled to be there.',
    hero: 'IMG_6861',
    publishedAt: null,
    approval: 'pending',
    body: [
      { type: 'p', text: 'A festival makes a promise to its audience before a single act is announced: that the day will be worth the journey, that the ground will be safe, that the music will be chosen with care.' },
      { type: 'p', text: 'Keeping that promise is curation — of artists, of place, of the order of a long evening. It is the same discipline as sequencing an album, at the scale of a landscape.' },
      { type: 'statement', text: 'Curation is composition at the scale of a day.' },
      { type: 'p', text: 'The Festival pillar is The Architect’s way of building that promise into something that lasts beyond one weekend.' },
    ],
  },
  {
    slug: 'teaching-what-took-years',
    title: 'Teaching what took years',
    category: 'people',
    standfirst: 'The shortest route through the music industry is someone who has already walked it, willing to draw the map.',
    hero: 'IMG_6867',
    publishedAt: null,
    approval: 'pending',
    body: [
      { type: 'p', text: 'Most of what a working producer knows is never written down: how a session runs, how a song gets finished, how a contract is read, how a career survives its first success.' },
      { type: 'p', text: 'An academy turns that unwritten knowledge into something passed on deliberately — in rooms full of notebooks, keyboards and questions.' },
      { type: 'image', media: 'IMG_6877', caption: 'The next generation, up close.' },
      { type: 'p', text: 'The Academy pillar is built on that idea: that a legacy is measured by the people it equips.' },
    ],
  },
  {
    slug: 'sound-is-architecture',
    title: 'Sound is architecture',
    category: 'music',
    standfirst: 'A track has foundations, load-bearing walls and open space. The producer decides where the light comes in.',
    hero: 'IMG_6881',
    publishedAt: null,
    approval: 'pending',
    body: [
      { type: 'p', text: 'Low end is the foundation. Rhythm is structure. The space between sounds is as designed as the sounds themselves — leave too little and a record suffocates; leave too much and it falls apart.' },
      { type: 'p', text: 'That is why “architect” is not a metaphor borrowed from somewhere else. It describes the job.' },
      { type: 'image', media: 'IMG_6888' },
      { type: 'statement', text: 'Build for the room. Then build the room.' },
    ],
  },
  {
    slug: 'directing-the-frame',
    title: 'Directing the frame',
    category: 'music',
    standfirst: 'A video is a second arrangement of the song — for the eye.',
    hero: 'IMG_6859',
    publishedAt: null,
    approval: 'pending',
    body: [
      { type: 'p', text: 'On set, the questions are the same ones asked at the console: what leads, what supports, what is left out. The answers are just made with light and lenses instead of faders.' },
      { type: 'image', media: 'IMG_6880', caption: 'A backstage corridor becomes a set.' },
      { type: 'p', text: 'Owning the image as carefully as the sound is part of building an artist’s world — and part of what turns a catalogue into a body of work.' },
    ],
  },
  {
    slug: 'the-city-after-dark',
    title: 'The city after dark',
    category: 'culture',
    standfirst: 'South African cities hum on a frequency of their own — highways, towers and the sound coming out of every open door.',
    hero: 'IMG_6872',
    publishedAt: null,
    approval: 'pending',
    body: [
      { type: 'p', text: 'Every scene starts somewhere specific: a city, a set of streets, a few rooms where people gather to hear what is new.' },
      { type: 'p', text: 'Johannesburg at dusk is a reminder that global music is always local first — built in particular places by particular people, then carried outward.' },
      { type: 'image', media: 'IMG_6860' },
      { type: 'p', text: 'The Community pillar starts here: with the people in the room, and a way to keep them close.' },
    ],
  },
];
