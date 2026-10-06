import { Suspense } from "react";
import { Lines } from "@/components/Lines";
import { Motion } from "@/components/Motion";
import { PartnershipForm } from "@/components/PartnershipForm";
import { PartnershipFormFromQuery } from "@/components/PartnershipFormFromQuery";
import { Eyebrow } from "@/components/ui";

export function EnquirySection() {
  return (
    <section id="enquire" aria-labelledby="enquire-title" className="theme-light scroll-mt-[var(--header-h)] bg-paper py-24 text-ink md:py-36">
      <Motion className="container-site grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+3rem)]">
            <Eyebrow className="text-smoke">Partnership enquiry</Eyebrow>
            <Lines id="enquire-title" className="font-display mt-8 text-section" lines={["Partner", "with Andile."]} />
            <p className="mt-8 max-w-sm text-smoke" data-reveal="">
              Seven short questions about the opportunity, your company and what you want it to achieve. Attach a brief
              if you have one.
            </p>
          </div>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <Suspense fallback={<PartnershipForm initial={{}} />}>
            <PartnershipFormFromQuery />
          </Suspense>
        </div>
      </Motion>
    </section>
  );
}
