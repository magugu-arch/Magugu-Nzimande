"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { track } from "@/lib/analytics";
import { validateDeckRequest, type FieldErrors } from "@/lib/enquiry/validate";
import type { Download } from "@/lib/types";
import { Field } from "./Field";

type State =
  | { phase: "closed" }
  | { phase: "open"; errors: FieldErrors; message?: string }
  | { phase: "sending" }
  | { phase: "done"; reference: string | null; preview: boolean };

/**
 * DOWNLOAD PARTNERSHIP DECK. With a deck file configured it is a plain tracked
 * download. Without one it opens a three-field request instead of linking to a
 * file that does not exist — gated only because there is nothing to download yet.
 */
export function DeckRequest({ deck }: { deck: Download }) {
  const [state, setState] = useState<State>({ phase: "closed" });
  const startedAt = useRef(0);
  const id = useId();

  if (deck.href) {
    return (
      <a
        href={deck.href}
        download
        onClick={() => track("deck_download", { source: "build_with_us" })}
        className="group inline-flex min-h-12 items-center gap-3 bg-ink px-6 meta text-paper hover:bg-charcoal"
      >
        Download Partnership Deck
        <ArrowDown aria-hidden="true" className="size-4" strokeWidth={1.5} />
        <span className="sr-only">({deck.format})</span>
      </a>
    );
  }

  if (state.phase === "done") {
    return (
      <div role="status" className="w-full border-t border-ink/20 pt-6">
        <p className="font-display text-card">Request received.</p>
        {state.preview ? (
          <p className="mt-3 max-w-md text-smoke">
            Preview mode: delivery is not connected on this deployment, so this request was not sent anywhere.
          </p>
        ) : (
          <p className="mt-3 max-w-md text-smoke">Your request has been passed to the partnerships team.</p>
        )}
        {state.reference && <p className="meta mt-4 text-smoke">Reference {state.reference}</p>}
      </div>
    );
  }

  if (state.phase === "closed") {
    return (
      <button
        type="button"
        onClick={() => {
          startedAt.current = Date.now();
          setState({ phase: "open", errors: {} });
          track("deck_download", { source: "build_with_us", mode: "request_opened" });
        }}
        aria-expanded={false}
        aria-controls={`${id}-form`}
        className="group inline-flex min-h-12 items-center gap-3 bg-ink px-6 meta text-paper hover:bg-charcoal"
      >
        Download Partnership Deck
        <ArrowDown aria-hidden="true" className="size-4" strokeWidth={1.5} />
      </button>
    );
  }

  const errors = state.phase === "open" ? state.errors : {};

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = validateDeckRequest(Object.fromEntries(form));
    if (!result.ok) {
      setState({ phase: "open", errors: result.errors });
      return;
    }
    form.set("kind", "deck");
    form.set("startedAt", String(startedAt.current));
    setState({ phase: "sending" });
    try {
      const res = await fetch("/api/partnership", { method: "POST", body: form });
      const body = (await res.json()) as { ok: boolean; reference?: string | null; delivery?: string; errors?: FieldErrors; message?: string };
      if (!body.ok) {
        setState({ phase: "open", errors: body.errors ?? {}, message: body.message });
        return;
      }
      track("deck_download", { source: "build_with_us", mode: "requested" });
      setState({ phase: "done", reference: body.reference ?? null, preview: body.delivery !== "webhook" });
    } catch {
      setState({ phase: "open", errors: {}, message: "The request could not be sent. Check your connection and try again." });
    }
  };

  return (
    <form id={`${id}-form`} onSubmit={submit} noValidate className="theme-light grid w-full max-w-xl gap-5 border-t border-ink/20 pt-6">
      <p className="text-smoke">The deck is shared on request. Three details and it is on its way.</p>
      <Field label="Your name" name="contactName" autoComplete="name" error={errors.contactName} required />
      <Field label="Company" name="company" autoComplete="organization" error={errors.company} required />
      <Field label="Work email" name="email" type="email" autoComplete="email" error={errors.email} required />
      <input type="text" name="nickname" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex gap-3 text-[0.95rem]">
        <input type="checkbox" name="consent" value="yes" className="mt-1 size-5 accent-ink" aria-invalid={!!errors.consent} aria-describedby={errors.consent ? `${id}-consent-err` : undefined} />
        <span>I agree that these details may be used to send the deck and follow up on it.</span>
      </label>
      {errors.consent && (
        <p id={`${id}-consent-err`} className="text-[0.9rem] text-[#8a2c1f]">
          {errors.consent}
        </p>
      )}
      {state.phase === "open" && state.message && (
        <p role="alert" className="text-[0.95rem] text-[#8a2c1f]">
          {state.message}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={state.phase === "sending"}
          className="group inline-flex min-h-12 items-center gap-3 bg-ink px-6 meta text-paper hover:bg-charcoal disabled:opacity-60"
        >
          {state.phase === "sending" ? "Sending…" : "Request the deck"}
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
      </div>
    </form>
  );
}
