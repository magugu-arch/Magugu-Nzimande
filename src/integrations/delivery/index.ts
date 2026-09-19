/**
 * The delivery-channel layer.
 *
 * Import from here rather than reaching into the tree, so the surface this
 * layer offers the rest of the app stays visible in one file and adapters
 * remain free to move.
 */

export * from './types';
export * from './statusMachine';
export * from './fulfilment';
export * from './money';
export * from './idempotency';
export * from './webhooks';
export * from './channelEligibility';
export * from './catalogueMapping';
export * from './deepLinks';
export {
  getProvider,
  isChannelEnabled,
  availabilityFor,
  listAvailability,
  defaultProviderFor,
  configureDirectChannel,
  resetProviderRegistry,
} from './providerRegistry';
export { PappasDirectAdapter, ProviderOrderRejected, haversineKm } from './providers/PappasDirectAdapter';
export { UberEatsAdapter } from './providers/UberEatsAdapter';
export { MrDAdapter } from './providers/MrDAdapter';
export { ExternalChannelAdapter, BrokerUnavailable } from './providers/ExternalChannelAdapter';
