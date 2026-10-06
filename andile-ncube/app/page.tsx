import type { Metadata } from "next";
import { site } from "@/data/site";
import { pageMetadata } from "@/lib/seo";
import { BuildWithUs } from "@/sections/BuildWithUs";
import { ChapterIntro } from "@/sections/ChapterIntro";
import { FinalStatement } from "@/sections/FinalStatement";
import { FlagshipSection } from "@/sections/FlagshipSection";
import { Hero } from "@/sections/Hero";
import { HouseSection } from "@/sections/HouseSection";
import { InstitutionSection } from "@/sections/InstitutionSection";
import { MultiplierSection } from "@/sections/MultiplierSection";
import { OwnershipStatement } from "@/sections/OwnershipStatement";
import { PilotSection } from "@/sections/PilotSection";
import { SlateSection } from "@/sections/SlateSection";
import { SponsorEngineSection } from "@/sections/SponsorEngineSection";

export const metadata: Metadata = {
  ...pageMetadata({ title: site.property, description: site.description, path: "/" }),
  title: { absolute: `${site.name} — ${site.property}` },
};

export default function Home() {
  return (
    <>
      <Hero />
      <ChapterIntro />
      <HouseSection />
      <FlagshipSection />
      <MultiplierSection />
      <SlateSection />
      <SponsorEngineSection />
      <InstitutionSection />
      <OwnershipStatement />
      <PilotSection />
      <BuildWithUs />
      <FinalStatement />
    </>
  );
}
