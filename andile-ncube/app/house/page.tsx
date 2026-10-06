import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ImageFeature } from "@/components/ImageFeature";
import { PageHero } from "@/components/PageHero";
import { TrackedLink } from "@/components/TrackedLink";
import { buttonClass } from "@/components/ui";
import { ctas } from "@/data/site";
import { pageMetadata } from "@/lib/seo";
import { FinalStatement } from "@/sections/FinalStatement";
import { HouseSection } from "@/sections/HouseSection";

export const metadata = pageMetadata({
  title: "The House",
  description:
    "The House That Andile Built: a real build documented from vision to ownership — the hero media property at the centre of Andile Ncube's owned platform.",
  path: "/house",
  image: "IMG_6897",
});

export default function HousePage() {
  return (
    <>
      <PageHero
        eyebrow="The House That Andile Built"
        title={["The house", "is the show."]}
        lede="A real build, documented from the first plan to the keys."
        image="IMG_6894"
        focus="40% 35%"
      >
        <TrackedLink href={ctas.watch.href} event="watch_click" eventProps={{ source: "house_hero" }} className={buttonClass.solid}>
          {ctas.watch.label}
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </TrackedLink>
      </PageHero>
      <HouseSection withLink={false} />
      <ImageFeature eyebrow="Materials" title={["Every material", "is a decision."]} image="IMG_6895" tone="stone">
        <p>
          Timber, stone, fittings and finishes are chosen on camera. Each choice is a scene — and the reason the Sponsor
          Engine starts with materials and hardware as its anchor category.
        </p>
        <p>
          <Link href="/partners#sponsor-engine" className={`${buttonClass.text} text-ink`}>
            See the sponsor categories <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
          </Link>
        </p>
      </ImageFeature>
      <ImageFeature eyebrow="On site" title={["Transparent", "by design."]} image="IMG_6898" reverse tone="dark">
        <p>
          The build is shown with the people doing it: the trades, the advisers and the problems solved along the way.
          The audience follows the work, not a finished set.
        </p>
      </ImageFeature>
      <FinalStatement />
    </>
  );
}
