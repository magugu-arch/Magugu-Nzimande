import { officialLinks, type OfficialLinkId } from '@scarlets/adapters';
import { placement, placementLabel, type Campaign, type Partner } from '@scarlets/domain';
import { CAMPAIGN_LIMITS } from '@/lib/campaign-rules';
import { placementLabelNames, placementNames } from '@/lib/format';
import { mediaChoices } from '@/lib/media';
import { ctaIdOf } from '@/lib/store';
import { utcToZonedInput } from '@/lib/time';
import { Field } from './ui';

export function CampaignFields({
  campaign,
  partners,
  defaults,
}: {
  campaign?: Campaign;
  partners: Partner[];
  defaults: { startsAt: string; endsAt: string };
}) {
  const links = Object.keys(officialLinks) as OfficialLinkId[];
  return (
    <>
      <div className="pair">
        <Field
          label="Partner slot"
          htmlFor="partnerId"
          hint="Placeholder slots. A real partner is added only once the club has approved it."
        >
          <select
            id="partnerId"
            name="partnerId"
            defaultValue={campaign?.partnerId ?? partners[0]?.id}
            aria-describedby="partnerId-hint"
          >
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name} (
                {partner.approved ? 'approved partner' : 'placeholder, not an approved partner'})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Image" htmlFor="mediaId" hint="Concept images only.">
          <select
            id="mediaId"
            name="mediaId"
            defaultValue={campaign?.mediaId ?? 'fan-zone-activation'}
            aria-describedby="mediaId-hint"
          >
            {mediaChoices().map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="pair">
        <Field
          label="Placement"
          htmlFor="placement"
          hint="One campaign runs in a placement at a time."
        >
          <select
            id="placement"
            name="placement"
            defaultValue={campaign?.placement ?? 'match_centre'}
            aria-describedby="placement-hint"
          >
            {placement.options.map((option) => (
              <option key={option} value={option}>
                {placementNames[option]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Visible label"
          htmlFor="label"
          hint="Supporters see this on the tile. Every campaign carries one."
        >
          <select
            id="label"
            name="label"
            defaultValue={campaign?.label ?? 'partner_feature'}
            aria-describedby="label-hint"
          >
            {placementLabel.options.map((option) => (
              <option key={option} value={option}>
                {placementLabelNames[option]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="pair">
        <Field label="Title" lang="EN" htmlFor="titleEn">
          <input
            id="titleEn"
            name="titleEn"
            type="text"
            required
            maxLength={CAMPAIGN_LIMITS.title}
            defaultValue={campaign?.title.en ?? ''}
          />
        </Field>
        <Field label="Title" lang="CY" htmlFor="titleCy">
          <input
            id="titleCy"
            name="titleCy"
            type="text"
            lang="cy"
            maxLength={CAMPAIGN_LIMITS.title}
            defaultValue={campaign?.title.cy ?? ''}
          />
        </Field>
      </div>
      <div className="pair">
        <Field label="Body" lang="EN" htmlFor="bodyEn">
          <textarea
            id="bodyEn"
            name="bodyEn"
            rows={3}
            required
            maxLength={CAMPAIGN_LIMITS.body}
            defaultValue={campaign?.body.en ?? ''}
          />
        </Field>
        <Field label="Body" lang="CY" htmlFor="bodyCy">
          <textarea
            id="bodyCy"
            name="bodyCy"
            rows={3}
            lang="cy"
            maxLength={CAMPAIGN_LIMITS.body}
            defaultValue={campaign?.body.cy ?? ''}
          />
        </Field>
      </div>
      <div className="pair">
        <Field label="Starts (UK time)" htmlFor="startsAt">
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={utcToZonedInput(campaign?.startsAt ?? defaults.startsAt)}
          />
        </Field>
        <Field label="Ends (UK time)" htmlFor="endsAt">
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={utcToZonedInput(campaign?.endsAt ?? defaults.endsAt)}
          />
        </Field>
      </div>
      <Field
        label="Link"
        htmlFor="cta"
        hint="A campaign can link only to an official club destination. Offer terms come from the partner and are not written here."
      >
        <select
          id="cta"
          name="cta"
          defaultValue={campaign ? ctaIdOf(campaign) : 'none'}
          aria-describedby="cta-hint"
        >
          <option value="none">No link</option>
          {links.map((id) => (
            <option key={id} value={id}>
              {officialLinks[id].label.en}
              {officialLinks[id].confirmed ? '' : ' (destination to be confirmed by the club)'}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
