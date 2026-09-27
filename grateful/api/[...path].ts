import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleNode } from '../server/node';

/**
 * Vercel serverless entry: every /api/* request lands here and is routed by
 * server/router.ts. Body parsing is disabled because payment webhooks are
 * verified against the raw body, byte for byte.
 */
export const config = { api: { bodyParser: false } };

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleNode(req, res);
}
