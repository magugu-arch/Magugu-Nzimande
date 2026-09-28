import type { FeatureFlags } from '../flags';
import { DomainError } from '../shared/errors';
import type {
  CommerceOrderRequest,
  CommerceOrderResult,
  CommerceProvider,
  CommerceQuote,
  ProviderId,
} from './types';

/**
 * §15 adapter skeletons. The brief is explicit: do not invent Uber Eats, Mr D
 * or Mábu-direct ordering endpoints, authentication, webhooks or commercial
 * terms. Each adapter therefore throws `<PROVIDER>_NOT_CONFIGURED`, and the
 * registry below never offers an adapter whose flag is off.
 */
function unconfigured(code: string): never {
  throw new DomainError(
    'NOT_CONFIGURED',
    'Ordering is not available in the app yet. Please call us to arrange collection.',
    code,
  );
}

export class MabuDirectCommerceAdapter implements CommerceProvider {
  readonly id = 'mabu-direct' as const;
  async quote(): Promise<CommerceQuote> {
    return unconfigured('MABU_DIRECT_ORDERING_NOT_CONFIGURED');
  }
  async createOrder(): Promise<CommerceOrderResult> {
    return unconfigured('MABU_DIRECT_ORDERING_NOT_CONFIGURED');
  }
  async cancelOrder(): Promise<void> {
    return unconfigured('MABU_DIRECT_ORDERING_NOT_CONFIGURED');
  }
}

export class UberEatsAdapter implements CommerceProvider {
  readonly id = 'uber-eats' as const;
  async quote(): Promise<CommerceQuote> {
    return unconfigured('UBER_EATS_NOT_CONFIGURED');
  }
  async createOrder(): Promise<CommerceOrderResult> {
    return unconfigured('UBER_EATS_NOT_CONFIGURED');
  }
  async cancelOrder(): Promise<void> {
    return unconfigured('UBER_EATS_NOT_CONFIGURED');
  }
}

export class MrDAdapter implements CommerceProvider {
  readonly id = 'mr-d' as const;
  async quote(): Promise<CommerceQuote> {
    return unconfigured('MR_D_NOT_CONFIGURED');
  }
  async createOrder(): Promise<CommerceOrderResult> {
    return unconfigured('MR_D_NOT_CONFIGURED');
  }
  async cancelOrder(): Promise<void> {
    return unconfigured('MR_D_NOT_CONFIGURED');
  }
}

/** Offers only providers that are both flagged on and (eventually) configured. */
export class CommerceRegistry {
  private readonly all: Record<ProviderId, CommerceProvider> = {
    'mabu-direct': new MabuDirectCommerceAdapter(),
    'uber-eats': new UberEatsAdapter(),
    'mr-d': new MrDAdapter(),
  };

  constructor(private readonly flags: FeatureFlags) {}

  enabled(): ProviderId[] {
    const out: ProviderId[] = [];
    if (this.flags.directOrderingEnabled) out.push('mabu-direct');
    if (this.flags.uberEatsEnabled) out.push('uber-eats');
    if (this.flags.mrDEnabled) out.push('mr-d');
    return out;
  }

  provider(id: ProviderId): CommerceProvider {
    if (!this.enabled().includes(id))
      unconfigured(`${id.toUpperCase().replace('-', '_')}_DISABLED`);
    return this.all[id];
  }

  async quote(request: CommerceOrderRequest): Promise<CommerceQuote> {
    return this.provider(request.provider).quote(request);
  }
}
