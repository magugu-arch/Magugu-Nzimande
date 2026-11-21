import { z } from 'zod';
import { localizedText } from './i18n';

/**
 * A supplied visual. Every one is concept material until the club confirms
 * rights, factual accuracy and publication approval, so `concept` is not
 * optional and cannot be false.
 */
export const mediaAsset = z.object({
  id: z.string(),
  /** Position in the briefing's asset inventory, 1 to 39. */
  number: z.number().int().min(1),
  file: z.string(),
  supplied: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  kind: z.enum(['identity', 'photograph']),
  /** What the image shows, for screen readers. Describes; never names a real person. */
  alt: localizedText,
  /** Planning label from the briefing's gallery. */
  label: localizedText,
  /** Where the briefing maps it in the product. */
  placement: z.string(),
  /** Focal point for cropping, 0 to 1 from the top-left. */
  focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  average: z.string().optional(),
  placeholder: z.string().optional(),
  note: localizedText.optional(),
  concept: z.literal(true),
});
export type MediaAsset = z.infer<typeof mediaAsset>;
