"use client";

import { useSearchParams } from "next/navigation";
import { PartnershipForm } from "./PartnershipForm";

/**
 * Prefills the flow from links such as an ENQUIRE button on a sponsor card
 * (`?opportunity=sponsor-flagship&category=automotive`). Rendered inside
 * Suspense so the rest of the page can still be prerendered.
 */
export function PartnershipFormFromQuery() {
  const params = useSearchParams();
  const opportunity = params.get("opportunity") ?? undefined;
  const category = params.get("category") ?? undefined;
  // Re-key on the query so following a second ENQUIRE link resets the prefill.
  return <PartnershipForm key={`${opportunity}-${category}`} initial={{ opportunity, category }} />;
}
