import { PRODUCTS, STORES } from '@bbq/seed';
import { NextResponse } from 'next/server';
import { areAccountsConfigured } from '@/lib/accounts/session';
import { isConsoleConfigured } from '@/lib/admin-auth';
import { readState, writeState } from '@/lib/demo-state';
import { isPaymentConfigured } from '@/lib/payments/registry';

/**
 * GET /api/health — is this deployment working, and what is it configured for.
 *
 * Two different questions, both of which an uptime check needs:
 *
 *  - Can it serve? The catalogue loaded and the state file can be read and
 *    written. A process that answers 200 while its storage is read-only is
 *    reporting the wrong thing: orders would be silently lost.
 *  - What is switched on? Payments, accounts and the console each fail closed
 *    when unconfigured, which is correct and invisible. A deployment that has
 *    quietly lost BBQ_PAYMENT_SECRET refuses every payment and looks healthy,
 *    so the flags are reported and an alert can be built on them.
 *
 * No secret, hostname or connection string appears here — only whether each is
 * present. A health endpoint is usually the least-protected route there is.
 */
export function GET() {
  const checks: Record<string, boolean> = {
    catalogue: PRODUCTS.length > 0 && STORES.length > 0,
    storage: storageWorks(),
  };

  const healthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      checks,
      // Not health. A build with no payment provider is correctly configured
      // for what it is, so these are reported separately and never make the
      // status degraded.
      configured: {
        payments: isPaymentConfigured(),
        accounts: areAccountsConfigured(),
        console: isConsoleConfigured(),
      },
      catalogue: { products: PRODUCTS.length, stores: STORES.length },
      at: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      // An uptime check that reads a cached 200 is checking its own cache.
      headers: { 'cache-control': 'no-store' },
    },
  );
}

/**
 * Whether the state file can be read and written.
 *
 * Writes what it just read, so the check is a real round trip and changes
 * nothing. `writeState` swallows its own errors by design — that is what keeps
 * a read-only filesystem from taking the storefront down — so the failure has
 * to be detected by reading back rather than by catching.
 */
function storageWorks(): boolean {
  try {
    const before = readState();
    writeState(before);
    return readState().sequence === before.sequence;
  } catch {
    return false;
  }
}
