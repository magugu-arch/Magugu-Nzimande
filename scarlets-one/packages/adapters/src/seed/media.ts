import { tx, type LocalizedText, type MediaAsset } from '@scarlets/domain';
import { mediaFiles } from './media.generated';

/**
 * The 39 supplied visuals: two identity references and 37 concept
 * photographs. Labels follow the briefing's gallery. Alt text describes what
 * is visible and never names a person: the photography is concept material
 * and the people in it are not presented as real supporters or squad members.
 */
interface Description {
  alt: string;
  label: string;
  placement: string;
  focus: [number, number];
  note?: LocalizedText;
}

const descriptions: Record<string, Description> = {
  crest: {
    alt: 'Scarlets crest: a red dragon with wings spread above the word Scarlets.',
    label: 'Official Scarlets crest artwork',
    placement: 'Identity reference',
    focus: [0.5, 0.5],
    note: tx('Supplied file used as it is. Never redrawn or altered.'),
  },
  'shirt-reference': {
    alt: 'A player standing in the red Scarlets home shirt, hands behind their back.',
    label: 'Official player shirt reference',
    placement: 'Kit identity reference',
    focus: [0.5, 0.3],
    note: tx('Kit reference only. Player identity and permission are confirmed separately.'),
  },
  'red-wall-hero': {
    alt: 'Supporters in red cheering in a floodlit stand at night, one with a fist raised, with the pitch and posts beyond.',
    label: 'The Red Wall - supporters in full voice',
    placement: 'Home hero',
    focus: [0.72, 0.42],
  },
  'parc-exterior': {
    alt: 'Aerial view of the stadium at dusk, red seats visible inside and people arriving outside.',
    label: 'Parc y Scarlets - exterior establishing view',
    placement: 'Matchday and venue',
    focus: [0.5, 0.5],
  },
  'stadium-bowl': {
    alt: 'Wide view from the stand of a floodlit pitch and full stadium during an evening match.',
    label: 'Floodlit stadium bowl - match-night panorama',
    placement: 'Match Centre',
    focus: [0.55, 0.5],
  },
  'scarves-celebration': {
    alt: 'Supporters in red holding scarves above their heads and laughing in the stand.',
    label: 'Scarves raised - collective supporter celebration',
    placement: 'Fan Zone',
    focus: [0.45, 0.45],
  },
  'arrival-family': {
    alt: 'Four supporters of different ages in red scarves walking and laughing towards the stadium.',
    label: 'Arrival at the ground - friends and family',
    placement: 'Matchday arrival',
    focus: [0.4, 0.45],
  },
  'first-visit': {
    alt: 'A parent and a young child in red scarves at the rail of the stand, the child looking out at the pitch in delight.',
    label: 'First visit - parent and child at the rail',
    placement: 'Family and first visit',
    focus: [0.45, 0.4],
  },
  'accessible-matchday': {
    alt: 'A supporter who uses a wheelchair laughing with a steward in a high-visibility vest outside the stadium, a companion alongside.',
    label: 'Accessible matchday - supporter assistance',
    placement: 'Matchday accessibility',
    focus: [0.45, 0.45],
  },
  'concourse-food': {
    alt: 'A supporter in a red and white scarf being handed a hot pie and a drink at a concourse kiosk.',
    label: 'Concourse food and drink - matchday hospitality',
    placement: 'Food and drink',
    focus: [0.6, 0.45],
  },
  'hospitality-lounge': {
    alt: 'Four guests talking over drinks at a lounge table, the pitch visible through the window behind them.',
    label: 'Premium hospitality - conversation beside the pitch',
    placement: 'Hospitality',
    focus: [0.5, 0.4],
  },
  'travel-together': {
    alt: 'Five supporters in red scarves walking along a wet seafront street, laughing.',
    label: 'Travel together - supporters in West Wales',
    placement: 'Travel',
    focus: [0.5, 0.4],
  },
  'action-attack': {
    alt: 'A player in red running with the ball as a defender in dark blue closes in.',
    label: 'Rugby action - open-field attack',
    placement: 'Match and fixtures',
    focus: [0.66, 0.4],
  },
  'tryline-moment': {
    alt: 'A player in red diving to ground the ball over the try line as team-mates celebrate behind.',
    label: 'Try-line moment - the emotional peak',
    placement: 'Match report',
    focus: [0.55, 0.5],
  },
  'defensive-tackle': {
    alt: 'A player in red tackling a ball carrier in dark blue around the waist.',
    label: 'Collision and commitment - defensive tackle',
    placement: 'Match statistics',
    focus: [0.5, 0.4],
  },
  'player-portrait': {
    alt: 'Studio portrait of a rugby player in a plain red training top against a dark background.',
    label: 'Player portrait - profile template',
    placement: 'Squad profile template',
    focus: [0.5, 0.3],
    note: tx('Layout template only. Not a named squad member.'),
  },
  'squad-portrait': {
    alt: 'A squad of players in red kit posed in two rows in front of a stand.',
    label: 'Squad portrait - the team together',
    placement: 'First team',
    focus: [0.5, 0.4],
  },
  'tunnel-huddle': {
    alt: 'Players in red with hands joined in a huddle in the tunnel, the pitch lit beyond.',
    label: 'Tunnel focus - pre-match team huddle',
    placement: 'Watch and Listen',
    focus: [0.5, 0.4],
  },
  'womens-action': {
    alt: 'A player in red carrying the ball into a tackle during a women’s match, with a team-mate in support.',
    label: 'Elite rugby action - contact and ball carry',
    placement: 'Women’s rugby',
    focus: [0.5, 0.35],
    note: tx(
      'The briefing lists women’s rugby as a placement that needs a club-approved image before production.',
    ),
  },
  'pathway-training': {
    alt: 'A coach guiding a young player with the ball during a training session on a grass pitch.',
    label: 'Player pathway - youth training session',
    placement: 'Academy and pathway',
    focus: [0.5, 0.4],
  },
  'grassroots-coaching': {
    alt: 'A coach crouching to talk with a group of young players holding rugby balls on a village pitch.',
    label: 'Academy coaching - next generation',
    placement: 'Community',
    focus: [0.55, 0.45],
  },
  'fan-cam-spotlight': {
    alt: 'A supporter in a red scarf smiling up at the stand with one arm raised.',
    label: 'Fan Cam - supporter in the spotlight',
    placement: 'Fan Cam',
    focus: [0.5, 0.35],
  },
  'scarves-raised-wide': {
    alt: 'A wide view of a stand at night full of supporters holding red scarves aloft.',
    label: 'The scarves raised - collective celebration portrait',
    placement: 'Editorial',
    focus: [0.6, 0.5],
  },
  'passport-phone': {
    alt: 'A hand holding a phone with a blank screen in the stand, the pitch out of focus beyond.',
    label: 'Scarlets Passport - phone in the stands',
    placement: 'Passport',
    focus: [0.55, 0.5],
  },
  'reward-redemption': {
    alt: 'A supporter showing a phone at a counter and being handed a folded red scarf.',
    label: 'Reward redemption - supporter receiving a scarf',
    placement: 'Rewards',
    focus: [0.45, 0.45],
  },
  'player-of-match': {
    alt: 'A muddy player in red smiling and waving to the crowd, team-mates applauding behind.',
    label: 'Player of the Match - player acknowledgement',
    placement: 'Player of the Match vote',
    focus: [0.45, 0.35],
  },
  'legacy-archive': {
    alt: 'A display case holding an old leather rugby ball, a framed team photograph and a folded red jersey.',
    label: 'The legacy archive - historic club memory',
    placement: 'History and heritage',
    focus: [0.5, 0.5],
  },
  'ambassador-portrait': {
    alt: 'Portrait of an older person in a dark jacket seated in front of framed jerseys.',
    label: 'Former player / club ambassador portrait',
    placement: 'Heritage profile template',
    focus: [0.5, 0.35],
    note: tx('Layout template only. Not a named former player.'),
  },
  generations: {
    alt: 'An older supporter, an adult and a child in red watching an evening match together from the stand.',
    label: 'Generations of Scarlets - family legacy',
    placement: 'Supporter stories',
    focus: [0.4, 0.4],
  },
  'interview-bts': {
    alt: 'A player being filmed in an interview, a camera and microphone in the foreground.',
    label: 'Behind the scenes - player interview production',
    placement: 'Watch and Listen',
    focus: [0.7, 0.45],
  },
  'global-watch': {
    alt: 'A group of supporters in red scarves watching a match on a screen together indoors.',
    label: 'Global Scarlets - supporters watching together',
    placement: 'Away and global supporters',
    focus: [0.45, 0.5],
  },
  'fan-zone-activation': {
    alt: 'A supporter playing a light-up reaction game at a Fan Zone stand while others watch.',
    label: 'Sponsor activation - interactive Fan Zone',
    placement: 'Partner activation',
    focus: [0.55, 0.5],
  },
  'big-screen-celebration': {
    alt: 'Supporters in red laughing and applauding below a blank big screen in the stand.',
    label: 'Sponsored Fan Cam - big-screen celebration',
    placement: 'Fan Cam big screen',
    focus: [0.4, 0.45],
  },
  'partner-hospitality': {
    alt: 'Four guests in conversation around a hospitality table beside a window onto the pitch.',
    label: 'Partner hospitality - business and rugby together',
    placement: 'Partner World',
    focus: [0.5, 0.4],
  },
  'app-in-hand': {
    alt: 'A hand holding a phone with a blank screen in a floodlit stand at night.',
    label: 'Smartphone in hand - Scarlets One app lifestyle',
    placement: 'App lifestyle',
    focus: [0.55, 0.5],
  },
  'launch-vertical': {
    alt: 'A supporter seen from behind wearing a red scarf, looking out over a floodlit stadium at night.',
    label: 'Mobile launch creative - vertical supporter moment',
    placement: 'Onboarding',
    focus: [0.5, 0.62],
  },
  'west-wales': {
    alt: 'Two walkers in red jackets on a clifftop above a wide beach at sunset.',
    label: 'West Wales atmosphere - place and belonging',
    placement: 'Region and belonging',
    focus: [0.4, 0.5],
  },
  'meeting-point': {
    alt: 'Four friends greeting each other and laughing outside the stadium.',
    label: 'Supporter meeting point - friends before kick-off',
    placement: 'Bring Your Crew',
    focus: [0.5, 0.4],
  },
  'volunteer-welcome': {
    alt: 'A matchday helper pointing out a place on a venue map for a supporter at a welcome desk.',
    label: 'Matchday welcome / volunteer support - venue guidance',
    placement: 'Venue guide',
    focus: [0.5, 0.45],
  },
};

export const mediaSeed: MediaAsset[] = mediaFiles.map((file) => {
  const d = descriptions[file.id];
  if (!d) throw new Error(`No description for supplied asset "${file.id}"`);
  return {
    id: file.id,
    number: file.number,
    file: file.file,
    supplied: file.supplied,
    width: file.width,
    height: file.height,
    kind: file.number <= 2 ? 'identity' : 'photograph',
    alt: tx(d.alt),
    label: tx(d.label),
    placement: d.placement,
    focus: { x: d.focus[0], y: d.focus[1] },
    average: file.average,
    placeholder: file.placeholder,
    note: d.note,
    concept: true,
  };
});

export const mediaById = new Map(mediaSeed.map((asset) => [asset.id, asset]));
