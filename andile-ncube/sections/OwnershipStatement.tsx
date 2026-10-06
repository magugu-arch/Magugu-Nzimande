import { Lines } from "@/components/Lines";
import { Motion } from "@/components/Motion";
import { site } from "@/data/site";

export function OwnershipStatement() {
  return (
    <section aria-labelledby="ownership-title" className="theme-dark relative overflow-hidden bg-ink py-28 text-paper md:py-44">
      <Motion className="container-site">
        <h2 id="ownership-title" className="sr-only">
          Ownership
        </h2>
        <Lines
          as="p"
          className="font-display text-[clamp(2.75rem,1rem+5.6vw,8rem)] leading-[0.88]"
          lines={[
            "He keeps the show.",
            <span key="a" className="text-stone">He keeps the audience.</span>,
            <span key="b" className="text-ash">He keeps the IP.</span>,
          ]}
        />
        <p className="mt-12 max-w-xl border-l border-brass pl-5 text-lede text-stone md:mt-16" data-reveal="">
          {site.engine} is the production and commercial engine, not the owner.
        </p>
      </Motion>
    </section>
  );
}
