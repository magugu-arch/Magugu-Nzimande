import {
  deliverDue,
  idMaker,
  isActionName,
  perform,
  type ActionArgs,
  type ActionName,
} from '../../admin/src/lib/actions';
import { seed, type ConsoleData } from '../../admin/src/lib/seed';
import type { Operator } from '../../admin/src/lib/types';
import { clock } from '../../src/core/time/clock';
import { HttpError } from './http';

/**
 * The operator console's backend. The console's data lives here, not in a
 * browser, and every change runs the console's own action functions
 * (admin/src/lib/actions.ts) as the operator the session identifies — never
 * as an operator the browser names. So scoped publishing, separation of
 * duties and the audit trail are enforced by the server.
 *
 * A production BFF keeps this in a database and sends approved notices to
 * the push service; here it is held in memory, seeded with the demo data.
 */

let data: ConsoleData | null = null;
const newId = idMaker();

function current(): ConsoleData {
  const now = clock.now();
  if (!data) data = seed(now);
  // Scheduled notices go out when their time comes.
  const due = deliverDue(data, now);
  if (due) data = due;
  return data;
}

export function operatorById(id: string): Operator | undefined {
  return current().operators.find((o) => o.id === id);
}

/** The console as the signed-in operator sees it. */
export function consoleView(operatorId: string): ConsoleData {
  return { ...current(), operatorId };
}

/** Runs one console action as this operator, or explains why not. */
export function consoleAction(
  operatorId: string,
  name: string,
  args: unknown,
): { message: string; id?: string; data: ConsoleData; action: ActionName } {
  if (!isActionName(name)) throw new HttpError(404, 'not-found', 'No such console action');
  if (!args || typeof args !== 'object') throw new HttpError(422, 'invalid', 'Missing details');
  const r = perform(
    current(),
    operatorId,
    name,
    args as ActionArgs[typeof name],
    clock.now(),
    newId,
  );
  if (!r.ok)
    throw new HttpError(r.forbidden ? 403 : 422, r.forbidden ? 'forbidden' : 'invalid', r.message);
  data = r.data;
  return {
    message: r.message,
    ...(r.id ? { id: r.id } : {}),
    data: consoleView(operatorId),
    action: name,
  };
}

/** Tests start each case from fresh seed data. */
export function resetConsoleForTesting() {
  data = null;
}
