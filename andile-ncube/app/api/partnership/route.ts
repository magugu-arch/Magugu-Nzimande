import { upload } from "@/data/enquiry";
import { deliver, DeliveryError } from "@/lib/enquiry/deliver";
import { rateLimited } from "@/lib/enquiry/rate-limit";
import {
  checkAttachmentBytes,
  checkAttachmentMeta,
  validateDeckRequest,
  validateEnquiry,
} from "@/lib/enquiry/validate";

/** Body cap: the 10 MB attachment plus room for the text fields. */
const MAX_BODY = upload.maxBytes + 512 * 1024;
/** A person cannot read and fill seven steps faster than this. */
const MIN_FILL_MS = 3000;

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY) {
    return json({ ok: false, message: "That upload is too large. Keep files under 10 MB." }, 413);
  }

  // Without a client address (no proxy in front), skip the limit rather than
  // put every visitor in one shared bucket.
  const ip = (request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "").split(",")[0]?.trim();
  if (ip && rateLimited(ip)) {
    return json(
      { ok: false, message: "Too many submissions from this connection. Try again in a few minutes." },
      429,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, message: "The form could not be read. Refresh and try again." }, 400);
  }

  // Spam traps: a hidden field people never see, and a minimum fill time.
  // Bots get a success-shaped response so they learn nothing.
  const startedAt = Number(form.get("startedAt"));
  if (form.get("nickname") || !Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FILL_MS) {
    return json({ ok: true, reference: null, delivery: "discarded" });
  }

  const raw: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    const values = form.getAll(key).filter((v): v is string => typeof v === "string");
    raw[key] = key === "objectives" ? values : values[0];
  }

  try {
    if (form.get("kind") === "deck") {
      const result = validateDeckRequest(raw);
      if (!result.ok) return json({ ok: false, errors: result.errors }, 422);
      const delivered = await deliver({ kind: "deck", data: result.data });
      return json({ ok: true, reference: delivered.reference, delivery: delivered.mode });
    }

    const result = validateEnquiry(raw);
    if (!result.ok) return json({ ok: false, errors: result.errors }, 422);

    const file = form.get("attachment");
    let attachment: File | null = null;
    if (file instanceof File && file.size > 0) {
      const problem =
        checkAttachmentMeta(file.name, file.size) ??
        checkAttachmentBytes(file.name, new Uint8Array(await file.slice(0, 8).arrayBuffer()));
      if (problem) return json({ ok: false, errors: { attachment: problem } }, 422);
      // Strip any path and unusual characters from the client-supplied name.
      const safeName = file.name.split(/[\\/]/).pop()!.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
      attachment = new File([file], safeName, { type: file.type });
    }

    const delivered = await deliver({ kind: "enquiry", data: result.data, attachment });
    return json({ ok: true, reference: delivered.reference, delivery: delivered.mode });
  } catch (err) {
    console.error("[enquiry] delivery failed:", err instanceof DeliveryError ? err.message : "unexpected error");
    return json(
      {
        ok: false,
        message: "Your enquiry could not be sent just now. Nothing was lost on your side — please try again shortly.",
      },
      502,
    );
  }
}
