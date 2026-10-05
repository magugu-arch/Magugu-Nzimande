/**
 * Defaults, set before the shared core reads its configuration. The
 * reference BFF serves the mock connectors from src/core/adapters/mock; a
 * production BFF swaps each one for a connector to the real NMU system.
 */
process.env.EXPO_PUBLIC_DATA_MODE = 'mock';
process.env.EXPO_PUBLIC_MOCK_ORDER_READY_SECONDS ??= process.env.BFF_ORDER_READY_SECONDS ?? '20';
process.env.EXPO_PUBLIC_DEMO_CLOCK ??= process.env.BFF_CLOCK ?? 'scenario';

export {};
