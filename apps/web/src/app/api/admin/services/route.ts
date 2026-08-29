import { ServiceModeSchema, z } from '@bbq/types';
import { NextResponse } from 'next/server';
import { currentStores, findStore, recordAudit, setService } from '@/lib/catalogue-state';

const BodySchema = z.object({
  storeId: z.string().min(1),
  mode: ServiceModeSchema,
  enabled: z.boolean(),
});

/**
 * POST /api/admin/services — switch a service on or off for one store.
 *
 * Unauthenticated, like the rest of the console. See the note on the
 * availability route.
 */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { storeId, mode, enabled } = parsed.data;
  const store = findStore(storeId);
  if (!store) {
    return NextResponse.json({ error: 'No such store' }, { status: 404 });
  }

  setService(storeId, mode, enabled);
  recordAudit('operations', `${store.name}: ${mode} switched ${enabled ? 'on' : 'off'}`);

  return NextResponse.json({ stores: currentStores() });
}
