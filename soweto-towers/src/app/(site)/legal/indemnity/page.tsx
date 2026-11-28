import type { Metadata } from 'next';
import { LegalDoc } from '@/components/content/LegalDoc';
import { medicalExclusions } from '@/content/catalog';
import { site } from '@/content/site';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Indemnity & Participant Declaration',
  description:
    'The indemnity, medical declaration and consent every participant accepts before bungee, SCAD, zipline, paintball or lift-ride activities at Soweto Towers (Orlando Towers).',
  path: '/legal/indemnity',
});

export default function IndemnityPage() {
  return (
    <LegalDoc
      name="Indemnity"
      path="/legal/indemnity"
      title="Indemnity & declaration"
      lede="Every participant accepts this before taking part. You sign it online when you book, so check-in is quick on the day."
      updated="28 November 2026"
      sections={[
        {
          heading: 'Assumption of risk',
          paragraphs: [
            'Bungee jumping, SCAD freefall, ziplining, paintball, base jumping and activities at height carry inherent risks, including the risk of serious injury or death, even when every safety procedure is followed. I take part voluntarily and accept these risks.',
          ],
        },
        {
          heading: 'Medical declaration',
          paragraphs: ['I confirm that I, and anyone I am booking for, do not have any of these conditions:'],
          list: medicalExclusions,
          after: ['If anything changes before the activity, I will tell the crew before taking part.'],
        },
        {
          heading: 'Participant declarations',
          list: [
            'The weight and age information in my booking is accurate, and I understand the crew will check it again on site.',
            'I will follow the crew’s instructions at all times and accept that their safety decisions are final.',
            'I am not under the influence of alcohol or drugs, and I will not take part if I am.',
            'I will not take my own cameras or loose equipment onto the bridge or into the tower.',
          ],
        },
        {
          heading: 'Participants under 18',
          paragraphs: [
            'As the parent or legal guardian of a participant under 18, I consent to their taking part, accept this indemnity on their behalf, and confirm that the information given for them is accurate. Nobody under 12 goes up the tower.',
          ],
        },
        {
          heading: 'Photos and video',
          paragraphs: [
            'I understand that the multimedia crew films bungee and SCAD jumps and that clips are sent to the contact details in my booking. Soweto Towers will only repost my clip publicly if I gave consent when booking.',
          ],
        },
        {
          heading: 'Release',
          paragraphs: [
            `To the extent the law allows, I release ${site.name}, its directors, crew and agents from claims for loss, injury or damage arising from my participation.`,
            'Nothing in this indemnity excludes liability that cannot lawfully be excluded, including under the Consumer Protection Act, 2008, for gross negligence.',
          ],
        },
        {
          heading: 'Electronic acceptance',
          paragraphs: [
            'Ticking the declaration box when you book, or signing on site, records your acceptance of this indemnity. A copy is linked from your booking confirmation.',
          ],
        },
      ]}
    />
  );
}
