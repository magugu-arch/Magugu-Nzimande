import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { TrackedLink } from "@/components/TrackedLink";
import { buttonClass } from "@/components/ui";
import { ctas } from "@/data/site";
import { pageMetadata } from "@/lib/seo";
import { FinalStatement } from "@/sections/FinalStatement";
import { FlagshipSection } from "@/sections/FlagshipSection";
import { MultiplierSection } from "@/sections/MultiplierSection";

export const metadata = pageMetadata({
  title: "The Flagship",
  description:
    "The Flagship: The House That Andile Built, produced as appointment viewing — weekly cadence, format bible, recurring segments, milestones and a short-form multiplier.",
  path: "/flagship",
  image: "IMG_6893",
});

export default function FlagshipPage() {
  return (
    <>
      <PageHero
        eyebrow="The Flagship"
        title={["Appointment", "viewing."]}
        lede="The House That Andile Built, produced every week."
        image="IMG_6893"
        focus="50% 30%"
      >
        <TrackedLink href="#episodes" event="watch_click" eventProps={{ source: "flagship_hero" }} className={buttonClass.solid}>
          See the episodes
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </TrackedLink>
        <TrackedLink href={ctas.pilot.href} event="partnership_start" eventProps={{ source: "flagship_hero" }} className={buttonClass.outline}>
          Sponsor the Flagship
        </TrackedLink>
      </PageHero>
      <FlagshipSection />
      <MultiplierSection />
      <FinalStatement />
    </>
  );
}
