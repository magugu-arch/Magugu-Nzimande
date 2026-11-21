import { SAMPLE_CATALOGUE } from '@hao/service-catalogue';

/**
 * The sample catalogue is static content, so public pages can read it while
 * rendering (including at build time) without going through the gateway.
 */
export { SAMPLE_CATALOGUE };

export function findService(codeOrSlug: string) {
  return SAMPLE_CATALOGUE.services.find(
    (service) => service.code === codeOrSlug || service.slug === codeOrSlug,
  );
}

/** Link to a service page by service code. Falls back to the catalogue. */
export function serviceHref(code: string): string {
  const service = findService(code);
  return service ? `/services/${service.slug}/` : '/services/';
}
