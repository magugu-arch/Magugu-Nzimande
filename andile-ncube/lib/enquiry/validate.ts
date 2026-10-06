import {
  budgetRanges,
  objectives,
  opportunities,
  upload,
  type BudgetValue,
  type ObjectiveValue,
  type OpportunityValue,
} from "@/data/enquiry";
import { sponsorCategories } from "@/data/sponsors";

/**
 * Validation shared by the browser and the server. The browser runs it for
 * instant feedback; the route handler runs it again and is the only one that
 * counts.
 */

export type EnquiryInput = {
  opportunity: OpportunityValue;
  sponsorCategory: string | null;
  company: string;
  website: string | null;
  contactName: string;
  role: string | null;
  email: string;
  phone: string | null;
  budget: BudgetValue;
  objectives: ObjectiveValue[];
  message: string;
};

export type DeckRequestInput = {
  contactName: string;
  email: string;
  company: string;
};

export type FieldErrors = Partial<Record<string, string>>;

export type Result<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const URLISH = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i;

type Raw = Record<string, unknown>;

const text = (raw: Raw, key: string) => {
  const value = raw[key];
  return typeof value === "string" ? value.trim() : "";
};

const optional = (value: string) => (value === "" ? null : value);

function required(errors: FieldErrors, key: string, value: string, label: string, max: number) {
  if (!value) errors[key] = `Enter ${label}.`;
  else if (value.length > max) errors[key] = `Keep ${label} under ${max} characters.`;
}

function maxLength(errors: FieldErrors, key: string, value: string, label: string, max: number) {
  if (value.length > max) errors[key] = `Keep ${label} under ${max} characters.`;
}

function checkEmail(errors: FieldErrors, value: string) {
  if (!value) errors.email = "Enter an email address.";
  else if (value.length > 200 || !EMAIL.test(value))
    errors.email = "Enter an email address in the format name@company.com.";
}

function checkConsent(errors: FieldErrors, raw: Raw) {
  if (text(raw, "consent") !== "yes")
    errors.consent = "Confirm that we may use these details to respond to you.";
}

/** Validates one step's fields, or all of them when `fields` is omitted. */
export function validateEnquiry(raw: Raw, fields?: readonly string[]): Result<EnquiryInput> {
  const errors: FieldErrors = {};
  const want = (key: string) => !fields || fields.includes(key);

  const opportunity = text(raw, "opportunity");
  if (want("opportunity") && !opportunities.some((o) => o.value === opportunity))
    errors.opportunity = "Choose the kind of partnership you have in mind.";

  const sponsorCategory = text(raw, "sponsorCategory");
  if (want("sponsorCategory") && sponsorCategory && !sponsorCategories.some((c) => c.slug === sponsorCategory))
    errors.sponsorCategory = "Choose a category from the list.";

  const company = text(raw, "company");
  if (want("company")) required(errors, "company", company, "your company name", 120);

  const website = text(raw, "website");
  if (want("website") && website && (website.length > 200 || !URLISH.test(website)))
    errors.website = "Enter a web address such as company.co.za, or leave this blank.";

  const contactName = text(raw, "contactName");
  if (want("contactName")) required(errors, "contactName", contactName, "your name", 120);

  const role = text(raw, "role");
  if (want("role")) maxLength(errors, "role", role, "your role", 120);

  const email = text(raw, "email");
  if (want("email")) checkEmail(errors, email);

  const phone = text(raw, "phone");
  if (want("phone") && phone && !PHONE.test(phone))
    errors.phone = "Enter a phone number using digits, spaces and an optional +, or leave this blank.";

  const budget = text(raw, "budget");
  if (want("budget") && !budgetRanges.some((b) => b.value === budget))
    errors.budget = "Choose a budget range, or “To be discussed”.";

  const rawObjectives = raw.objectives;
  const chosen = (Array.isArray(rawObjectives) ? rawObjectives : [rawObjectives]).filter(
    (v): v is string => typeof v === "string" && v !== "",
  );
  if (want("objectives")) {
    if (chosen.length === 0) errors.objectives = "Choose at least one objective.";
    else if (!chosen.every((v) => objectives.some((o) => o.value === v)))
      errors.objectives = "Choose objectives from the list.";
  }

  const message = text(raw, "message");
  if (want("message")) {
    if (message.length < 20) errors.message = "Tell us a little more — at least 20 characters.";
    else if (message.length > 4000) errors.message = "Keep your message under 4,000 characters.";
  }

  if (want("consent")) checkConsent(errors, raw);

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      opportunity: opportunity as OpportunityValue,
      sponsorCategory: optional(sponsorCategory),
      company,
      website: optional(website),
      contactName,
      role: optional(role),
      email,
      phone: optional(phone),
      budget: budget as BudgetValue,
      objectives: [...new Set(chosen)] as ObjectiveValue[],
      message,
    },
  };
}

export function validateDeckRequest(raw: Raw): Result<DeckRequestInput> {
  const errors: FieldErrors = {};
  const contactName = text(raw, "contactName");
  required(errors, "contactName", contactName, "your name", 120);
  const company = text(raw, "company");
  required(errors, "company", company, "your company name", 120);
  const email = text(raw, "email");
  checkEmail(errors, email);
  checkConsent(errors, raw);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { contactName, company, email } };
}

/** Name and size checks, usable in the browser before upload. */
export function checkAttachmentMeta(name: string, size: number): string | null {
  const lower = name.toLowerCase();
  if (!upload.extensions.some((ext) => lower.endsWith(ext)))
    return "Upload a PDF, Word (.docx) or PowerPoint (.pptx) file.";
  if (size === 0) return "That file is empty.";
  if (size > upload.maxBytes) return "Keep the file under 10 MB.";
  return null;
}

/**
 * Server-side content check: the bytes must match the extension. A renamed
 * executable fails here even though its name passed `checkAttachmentMeta`.
 */
export function checkAttachmentBytes(name: string, head: Uint8Array): string | null {
  const lower = name.toLowerCase();
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04; // PK..
  if (lower.endsWith(".pdf") ? isPdf : isZip) return null;
  return "That file does not look like the type its name says. Upload a PDF, .docx or .pptx.";
}
