import { ArrowDown } from "lucide-react";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { buttonClass } from "@/components/ui";
import { pageMetadata } from "@/lib/seo";
import { BuildWithUs } from "@/sections/BuildWithUs";
import { EnquirySection } from "@/sections/EnquirySection";
import { InstitutionSection } from "@/sections/InstitutionSection";
import { PilotSection } from "@/sections/PilotSection";
import { SponsorEngineSection } from "@/sections/SponsorEngineSection";

export const metadata = pageMetadata({
  title: "Partners — The Sponsor Engine",
  description:
    "Five sponsor categories built into The House That Andile Built — materials & hardware, home finance, automotive, home tech & security, insurance & services — and a structured partnership enquiry.",
  path: "/partners",
  image: "IMG_6902",
});

export default function PartnersPage() {
  return (
    <>
      <PageHero
        eyebrow="Partners / Sponsor Engine"
        title={["Build the story", "around the", "category."]}
        lede="Structured inventory for brands that belong inside the build — not beside it."
        image="IMG_6902"
        focus="55% 30%"
      >
        <Link href="#enquire" className={buttonClass.solid}>
          Partner with Andile
          <ArrowDown aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </Link>
        <Link href="#sponsor-engine" className={buttonClass.outline}>
          See the categories
        </Link>
      </PageHero>
      <SponsorEngineSection />
      <InstitutionSection />
      <PilotSection />
      <BuildWithUs />
      <EnquirySection />
    </>
  );
}
