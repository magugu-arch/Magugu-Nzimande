/**
 * Versioned sample service catalogue and guidance.
 *
 * Pure, static content: no storage, no network. Every item is sample content
 * for a concept prototype and carries the content version and effective date.
 * Nothing here is a real Department of Home Affairs fee, requirement,
 * eligibility rule, timeframe or outcome.
 */
import {
  DEMO,
  type CataloguePort,
  type GuidanceArticle,
  type ServiceDefinition,
  type ServiceDomainInfo,
} from '@hao/api-contracts';
import { GatewayError } from '@hao/shared-types';
import { DOMAINS } from './content/domains';
import { GUIDANCE } from './content/guidance';
import { SERVICES } from './content/services';
import { searchCatalogue } from './search';

export { searchCatalogue, searchTerms } from './search';

export const SAMPLE_CATALOGUE: {
  version: string;
  effectiveDate: string;
  notice: string;
  domains: ServiceDomainInfo[];
  services: ServiceDefinition[];
  guidance: GuidanceArticle[];
} = {
  version: DEMO.contentVersion,
  effectiveDate: DEMO.contentEffectiveDate,
  notice:
    'This is sample content for a concept prototype, and the real requirements, fees and timeframes will come from the Department of Home Affairs service owners.',
  domains: DOMAINS,
  services: SERVICES,
  guidance: GUIDANCE,
};

/** Callers get their own copy, so nothing can edit the shared sample content by accident. */
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createCatalogueService(): CataloguePort {
  return {
    async getContentVersion() {
      const { version, effectiveDate, notice } = SAMPLE_CATALOGUE;
      return { version, effectiveDate, notice };
    },

    async listDomains() {
      return copy(SAMPLE_CATALOGUE.domains);
    },

    async listServices(filter) {
      const domain = filter?.domain;
      const services =
        domain === undefined
          ? SAMPLE_CATALOGUE.services
          : SAMPLE_CATALOGUE.services.filter((service) => service.domain === domain);
      return copy(services);
    },

    async getService(codeOrSlug) {
      const wanted = codeOrSlug.trim();
      const service = SAMPLE_CATALOGUE.services.find(
        (candidate) =>
          candidate.code === wanted.toUpperCase() || candidate.slug === wanted.toLowerCase(),
      );
      if (!service) {
        throw new GatewayError('NOT_FOUND', {
          safeMessage: 'We could not find that service. It may have been renamed or moved.',
        });
      }
      return copy(service);
    },

    async listGuidance() {
      return copy(SAMPLE_CATALOGUE.guidance);
    },

    async search(query) {
      return searchCatalogue(SAMPLE_CATALOGUE, query);
    },
  };
}
