"use client";

import { ArrowLeft, ArrowRight, Check, Paperclip, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { budgetRanges, objectives, opportunities, upload } from "@/data/enquiry";
import { sponsorCategories } from "@/data/sponsors";
import { track } from "@/lib/analytics";
import { checkAttachmentMeta, validateEnquiry, type FieldErrors } from "@/lib/enquiry/validate";
import { Field, TextArea } from "./Field";

type Values = {
  opportunity: string;
  sponsorCategory: string;
  company: string;
  website: string;
  contactName: string;
  role: string;
  email: string;
  phone: string;
  budget: string;
  objectives: string[];
  message: string;
  consent: string;
};

const steps = [
  { id: "opportunity", label: "Opportunity", title: "What would you like to build together?", fields: ["opportunity", "sponsorCategory"] },
  { id: "company", label: "Company", title: "Which company is this for?", fields: ["company", "website"] },
  { id: "contact", label: "Contact", title: "Who should we speak to?", fields: ["contactName", "role", "email", "phone"] },
  { id: "budget", label: "Budget", title: "What budget range are you working with?", fields: ["budget"] },
  { id: "objective", label: "Objective", title: "What should the partnership achieve?", fields: ["objectives"] },
  { id: "message", label: "Message", title: "Tell us about the idea.", fields: ["message"] },
  { id: "upload", label: "Brief", title: "Attach a brief, if you have one.", fields: ["attachment", "consent"] },
] as const;

/** Wall-clock time for the spam check; only ever called from event handlers. */
const now = () => Date.now();

const stepOf = (field: string) => Math.max(0, steps.findIndex((s) => (s.fields as readonly string[]).includes(field)));

type Status =
  | { phase: "editing" }
  | { phase: "sending" }
  | { phase: "sent"; reference: string | null; preview: boolean };

const errorText = "text-[0.9rem] text-[#8a2c1f]";

function Choice({
  type,
  name,
  value,
  checked,
  onChange,
  children,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex min-h-14 cursor-pointer items-center gap-4 border px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
        checked ? "border-ink bg-ink text-paper" : "border-ink/25 hover:border-ink"
      }`}
    >
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden="true"
        className={`flex size-5 shrink-0 items-center justify-center border ${type === "radio" ? "rounded-full" : ""} ${
          checked ? "border-paper" : "border-ink/40"
        }`}
      >
        {checked && <Check className="size-3.5" strokeWidth={2} />}
      </span>
      <span className="meta">{children}</span>
    </label>
  );
}

/**
 * The partnership enquiry: seven short steps, one question each, so it reads
 * as a business conversation rather than a contact form. Values persist while
 * moving back and forth; each step is validated before moving on, and the
 * server validates everything again on submit.
 */
export function PartnershipForm({ initial }: { initial: { opportunity?: string; category?: string } }) {
  const id = useId();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(() => ({
    opportunity: opportunities.some((o) => o.value === initial.opportunity) ? initial.opportunity! : "",
    sponsorCategory: sponsorCategories.some((c) => c.slug === initial.category) ? initial.category! : "",
    company: "",
    website: "",
    contactName: "",
    role: "",
    email: "",
    phone: "",
    budget: "",
    objectives: [],
    message: "",
    consent: "",
  }));
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ phase: "editing" });
  const startedAt = useRef<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const moved = useRef(false);
  const done = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status.phase === "sent") done.current?.focus();
  }, [status.phase]);

  // Move focus to the new step's question so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [step]);

  const begin = () => {
    if (startedAt.current !== null) return;
    startedAt.current = now();
    track("partnership_start", { source: "enquiry_form", opportunity: values.opportunity || null });
  };

  const set = (key: keyof Values, value: string) => {
    begin();
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggleObjective = (value: string) => {
    begin();
    setValues((v) => ({
      ...v,
      objectives: v.objectives.includes(value) ? v.objectives.filter((o) => o !== value) : [...v.objectives, value],
    }));
    setErrors((e) => ({ ...e, objectives: undefined }));
  };

  const goTo = (next: number) => {
    moved.current = true;
    setStep(next);
    setFormError(null);
  };

  const validateStep = (index: number) => {
    const fields = steps[index]!.fields.filter((f) => f !== "attachment");
    const result = validateEnquiry(values, fields);
    let stepErrors: FieldErrors = result.ok ? {} : result.errors;
    if (index === stepOf("attachment") && file) {
      const problem = checkAttachmentMeta(file.name, file.size);
      if (problem) stepErrors = { ...stepErrors, attachment: problem };
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const next = () => {
    if (validateStep(step)) goTo(step + 1);
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    begin();
    const chosen = e.target.files?.[0] ?? null;
    if (!chosen) return;
    const problem = checkAttachmentMeta(chosen.name, chosen.size);
    setErrors((er) => ({ ...er, attachment: problem ?? undefined }));
    setFile(problem ? null : chosen);
    if (problem && fileInput.current) fileInput.current.value = "";
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step < steps.length - 1) {
      next();
      return;
    }
    const all = validateEnquiry(values);
    if (!all.ok) {
      setErrors(all.errors);
      goTo(stepOf(Object.keys(all.errors)[0]!));
      return;
    }
    if (!validateStep(step)) return;

    const body = new FormData();
    for (const [key, value] of Object.entries(values)) {
      if (Array.isArray(value)) value.forEach((v) => body.append(key, v));
      else body.set(key, value);
    }
    if (file) body.set("attachment", file);
    body.set("kind", "enquiry");
    body.set("startedAt", String(startedAt.current ?? now()));
    body.set("nickname", (e.currentTarget.elements.namedItem("nickname") as HTMLInputElement | null)?.value ?? "");

    setStatus({ phase: "sending" });
    setFormError(null);
    try {
      const res = await fetch("/api/partnership", { method: "POST", body });
      const data = (await res.json()) as {
        ok: boolean;
        reference?: string | null;
        delivery?: string;
        errors?: FieldErrors;
        message?: string;
      };
      if (!data.ok) {
        setStatus({ phase: "editing" });
        if (data.errors && Object.keys(data.errors).length) {
          setErrors(data.errors);
          goTo(stepOf(Object.keys(data.errors)[0]!));
        } else {
          setFormError(data.message ?? "Something went wrong. Please try again.");
        }
        return;
      }
      track("partnership_complete", { opportunity: values.opportunity, budget: values.budget });
      setStatus({ phase: "sent", reference: data.reference ?? null, preview: data.delivery !== "webhook" });
    } catch {
      setStatus({ phase: "editing" });
      setFormError("Your enquiry could not be sent. Check your connection and try again — your answers are still here.");
    }
  };

  if (status.phase === "sent") {
    return (
      <div role="status" ref={done} tabIndex={-1} className="border-t border-ink/20 pt-10 outline-none">
        <p className="meta text-smoke">Partnership enquiry</p>
        <p className="font-display mt-4 text-section">Brief received.</p>
        {status.preview ? (
          <p className="mt-6 max-w-lg border-l-2 border-brass pl-4 text-smoke">
            Preview mode: enquiry delivery is not connected on this deployment yet, so this enquiry was checked but not
            sent to anyone.
          </p>
        ) : (
          <p className="mt-6 max-w-lg text-lede">Thank you. Your enquiry has been sent to the partnerships team.</p>
        )}
        {status.reference && <p className="meta mt-8 text-smoke">Reference {status.reference}</p>}
      </div>
    );
  }

  const current = steps[step]!;
  const isLast = step === steps.length - 1;
  const err = (key: string) => errors[key];

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${id}-q`} className="theme-light relative">
      {/* Progress */}
      <div className="flex items-center justify-between gap-4">
        <p className="meta text-smoke" aria-live="polite">
          Step {step + 1} of {steps.length} — {current.label}
        </p>
        <ol className="hidden gap-1 sm:flex" aria-hidden="true">
          {steps.map((s, i) => (
            <li key={s.id} className={`h-1 w-6 ${i <= step ? "bg-ink" : "bg-ink/15"}`} />
          ))}
        </ol>
      </div>
      <div aria-hidden="true" className="mt-3 h-px bg-ink/15 sm:hidden">
        <div className="h-px bg-ink transition-[width] duration-500" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>

      <h3 id={`${id}-q`} ref={heading} tabIndex={-1} className="font-display mt-8 text-card outline-none md:text-[clamp(2rem,1.4rem+1.6vw,3rem)]">
        {current.title}
      </h3>

      <div className="mt-8 grid gap-6">
        {current.id === "opportunity" && (
          <>
            <fieldset aria-describedby={err("opportunity") ? `${id}-opp-err` : undefined}>
              <legend className="sr-only">Opportunity</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {opportunities.map((o) => (
                  <Choice key={o.value} type="radio" name="opportunity" value={o.value} checked={values.opportunity === o.value} onChange={() => set("opportunity", o.value)}>
                    {o.label}
                  </Choice>
                ))}
              </div>
              {err("opportunity") && (
                <p id={`${id}-opp-err`} className={`mt-3 ${errorText}`}>
                  {err("opportunity")}
                </p>
              )}
            </fieldset>
            {(values.opportunity === "sponsor-flagship" || values.opportunity === "brand-integration") && (
              <div className="grid gap-2">
                <label htmlFor={`${id}-cat`} className="meta">
                  Sponsor category <span className="ml-2 normal-case tracking-normal opacity-70">(optional)</span>
                </label>
                <select
                  id={`${id}-cat`}
                  name="sponsorCategory"
                  value={values.sponsorCategory}
                  onChange={(e) => set("sponsorCategory", e.target.value)}
                  className="min-h-12 border-0 border-b border-ink/40 bg-transparent text-[1.05rem]"
                >
                  <option value="">Not sure yet</option>
                  {sponsorCategories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name} — {c.role}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {current.id === "company" && (
          <>
            <Field label="Company name" name="company" autoComplete="organization" value={values.company} onChange={(e) => set("company", e.target.value)} error={err("company")} required />
            <Field label="Website" name="website" inputMode="url" autoComplete="url" placeholder="company.co.za" value={values.website} onChange={(e) => set("website", e.target.value)} error={err("website")} />
          </>
        )}

        {current.id === "contact" && (
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Your name" name="contactName" autoComplete="name" value={values.contactName} onChange={(e) => set("contactName", e.target.value)} error={err("contactName")} required />
            <Field label="Role" name="role" autoComplete="organization-title" value={values.role} onChange={(e) => set("role", e.target.value)} error={err("role")} />
            <Field label="Work email" name="email" type="email" autoComplete="email" value={values.email} onChange={(e) => set("email", e.target.value)} error={err("email")} required />
            <Field label="Phone" name="phone" type="tel" autoComplete="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} error={err("phone")} />
          </div>
        )}

        {current.id === "budget" && (
          <fieldset aria-describedby={err("budget") ? `${id}-budget-err` : undefined}>
            <legend className="sr-only">Budget range</legend>
            <div className="grid gap-2">
              {budgetRanges.map((b) => (
                <Choice key={b.value} type="radio" name="budget" value={b.value} checked={values.budget === b.value} onChange={() => set("budget", b.value)}>
                  {b.label}
                </Choice>
              ))}
            </div>
            <p className="mt-3 text-[0.9rem] text-smoke">Used only to route your enquiry. It is not a quote or a rate.</p>
            {err("budget") && (
              <p id={`${id}-budget-err`} className={`mt-2 ${errorText}`}>
                {err("budget")}
              </p>
            )}
          </fieldset>
        )}

        {current.id === "objective" && (
          <fieldset aria-describedby={err("objectives") ? `${id}-obj-err` : undefined}>
            <legend className="meta mb-3 text-smoke">Choose all that apply</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {objectives.map((o) => (
                <Choice key={o.value} type="checkbox" name="objectives" value={o.value} checked={values.objectives.includes(o.value)} onChange={() => toggleObjective(o.value)}>
                  {o.label}
                </Choice>
              ))}
            </div>
            {err("objectives") && (
              <p id={`${id}-obj-err`} className={`mt-3 ${errorText}`}>
                {err("objectives")}
              </p>
            )}
          </fieldset>
        )}

        {current.id === "message" && (
          <TextArea
            label="Your message"
            name="message"
            hint="The brand, the audience you want to reach, timing, and anything already decided."
            value={values.message}
            onChange={(e) => set("message", e.target.value)}
            error={err("message")}
            maxLength={4000}
            required
          />
        )}

        {current.id === "upload" && (
          <>
            <div className="grid gap-3">
              <p className="meta">
                Brief <span className="ml-2 normal-case tracking-normal opacity-70">(optional)</span>
              </p>
              <p id={`${id}-file-hint`} className="text-[0.9rem] text-smoke">
                PDF, Word (.docx) or PowerPoint (.pptx), up to 10 MB.
              </p>
              {file ? (
                <div className="flex min-h-14 items-center justify-between gap-4 border border-ink/25 px-4">
                  <span className="flex min-w-0 items-center gap-3">
                    <Paperclip aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{file.name}</span>
                    <span className="meta shrink-0 text-smoke">
                      {file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                    className="inline-flex size-11 items-center justify-center"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X aria-hidden="true" className="size-4" strokeWidth={1.5} />
                  </button>
                </div>
              ) : (
                <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-ink/40 px-4 text-center transition-colors hover:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink">
                  <Paperclip aria-hidden="true" className="size-5" strokeWidth={1.5} />
                  <span className="meta">Choose a file</span>
                  <input
                    ref={fileInput}
                    type="file"
                    name="attachment"
                    accept={upload.accept}
                    onChange={onFile}
                    className="sr-only"
                    aria-describedby={`${id}-file-hint${err("attachment") ? ` ${id}-file-err` : ""}`}
                  />
                </label>
              )}
              {err("attachment") && (
                <p id={`${id}-file-err`} className={errorText}>
                  {err("attachment")}
                </p>
              )}
            </div>
            <div>
              <label className="flex cursor-pointer gap-3 text-[0.95rem]">
                <input
                  type="checkbox"
                  name="consent"
                  checked={values.consent === "yes"}
                  onChange={(e) => set("consent", e.target.checked ? "yes" : "")}
                  className="mt-0.5 size-5 shrink-0 accent-ink"
                  aria-invalid={!!err("consent")}
                  aria-describedby={err("consent") ? `${id}-consent-err` : undefined}
                />
                <span>I agree that the details in this enquiry may be used to respond to it.</span>
              </label>
              {err("consent") && (
                <p id={`${id}-consent-err`} className={`mt-2 ${errorText}`}>
                  {err("consent")}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Spam trap: invisible to people, irresistible to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Leave this empty
          <input type="text" name="nickname" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {formError && (
        <p role="alert" className={`mt-6 ${errorText}`}>
          {formError}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 pt-6">
        {step > 0 ? (
          <button type="button" onClick={() => goTo(step - 1)} className="meta inline-flex min-h-12 items-center gap-2 px-1">
            <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.5} /> Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={status.phase === "sending"}
          className="group inline-flex min-h-12 items-center gap-3 bg-ink px-6 meta text-paper transition-colors hover:bg-charcoal disabled:opacity-60"
        >
          {isLast ? (status.phase === "sending" ? "Sending…" : "Send partnership enquiry") : "Continue"}
          <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
        </button>
      </div>
    </form>
  );
}
