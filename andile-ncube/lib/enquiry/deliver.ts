import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import type { DeckRequestInput, EnquiryInput } from "./validate";

/**
 * The CRM / email integration boundary. Everything that leaves the server for
 * a third party goes through `deliver()`.
 *
 * - With ENQUIRY_WEBHOOK_URL set, the enquiry is POSTed there as multipart
 *   form data (an `enquiry` JSON part plus the optional `attachment`), signed
 *   with an HMAC-SHA256 of the JSON part in `X-Signature` when
 *   ENQUIRY_WEBHOOK_SECRET is set. Point it at Zapier, Make, a HubSpot or
 *   Pipedrive intake, or your own endpoint.
 * - Without it, the site runs in preview mode: nothing is sent or stored, the
 *   response says so, and the success screen tells the visitor plainly.
 */

export type Submission =
  | { kind: "enquiry"; data: EnquiryInput; attachment: File | null }
  | { kind: "deck"; data: DeckRequestInput };

export type DeliveryResult = { mode: "webhook" | "preview"; reference: string };

export class DeliveryError extends Error {}

export function newReference() {
  return `AN-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export async function deliver(submission: Submission): Promise<DeliveryResult> {
  const reference = newReference();
  const url = process.env.ENQUIRY_WEBHOOK_URL;

  if (!url) {
    // Preview mode. Log the shape, never the personal data.
    console.info(`[enquiry:preview] ${reference} kind=${submission.kind} — not delivered`);
    return { mode: "preview", reference };
  }

  const json = JSON.stringify({
    reference,
    kind: submission.kind,
    receivedAt: new Date().toISOString(),
    ...submission.data,
  });

  const body = new FormData();
  body.set("enquiry", json);
  if (submission.kind === "enquiry" && submission.attachment) {
    body.set("attachment", submission.attachment, submission.attachment.name);
  }

  const headers: Record<string, string> = {};
  const secret = process.env.ENQUIRY_WEBHOOK_SECRET;
  if (secret) headers["X-Signature"] = createHmac("sha256", secret).update(json).digest("hex");

  const res = await fetch(url, {
    method: "POST",
    body,
    headers,
    signal: AbortSignal.timeout(15_000),
  }).catch((err: unknown) => {
    throw new DeliveryError(`Webhook unreachable: ${err instanceof Error ? err.name : "error"}`);
  });
  if (!res.ok) throw new DeliveryError(`Webhook responded ${res.status}`);

  return { mode: "webhook", reference };
}
