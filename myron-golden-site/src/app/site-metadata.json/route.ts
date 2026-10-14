import { IS_PREVIEW } from '@/lib/env';
import { buildSiteMetadata } from '@/lib/site-metadata';

/**
 * The review trail as JSON — preview only. Production keeps provenance notes
 * and image-rights status internal.
 */
export async function GET() {
  if (!IS_PREVIEW) return new Response('Not found', { status: 404 });
  return Response.json(buildSiteMetadata(), {
    headers: { 'x-robots-tag': 'noindex' },
  });
}
