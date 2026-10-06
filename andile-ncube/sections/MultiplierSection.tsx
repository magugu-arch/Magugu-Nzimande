import { Lines } from "@/components/Lines";
import { Media } from "@/components/Media";
import { Motion } from "@/components/Motion";
import { Rail } from "@/components/Rail";
import { Eyebrow } from "@/components/ui";
import { multiplierItems } from "@/data/episodes";

/** One production day, many outputs — shown as a horizontal rail of mixed aspect ratios. */
export function MultiplierSection() {
  return (
    <section aria-labelledby="multiplier-title" className="theme-dark bg-charcoal py-24 text-paper md:py-36">
      <Motion>
        <div className="container-site grid gap-8 md:grid-cols-12">
          <div className="md:col-span-7">
            <Eyebrow className="text-ash">Short-form multiplier</Eyebrow>
            <Lines id="multiplier-title" className="font-display mt-8 text-section" lines={["One shoot.", "Many stories."]} />
          </div>
          <p className="self-end text-ash md:col-span-4 md:col-start-9" data-reveal="">
            Every shoot is planned for the hero episode and for everything cut from it: short clips, vertical edits and
            milestone moments for each platform. Examples below show the shape, not published clips.
          </p>
        </div>
        <Rail label="Short-form outputs from one shoot" className="mt-12 md:mt-16">
          {multiplierItems.map((item, i) => (
            <li
              key={`${item.image}-${i}`}
              className={`shrink-0 snap-start ${
                item.orientation === "portrait" ? "w-[46%] sm:w-[28%] lg:w-[17%]" : "w-[82%] sm:w-[56%] lg:w-[38%]"
              }`}
            >
              <figure>
                <Media
                  id={item.image}
                  sizes={item.orientation === "portrait" ? "(min-width: 1024px) 17vw, 46vw" : "(min-width: 1024px) 38vw, 82vw"}
                  className={item.orientation === "portrait" ? "aspect-[9/16]" : "aspect-video lg:aspect-[16/11]"}
                  decorative
                />
                <figcaption className="meta mt-3 flex justify-between text-ash">
                  <span>{item.kind}</span>
                  <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </Rail>
      </Motion>
    </section>
  );
}
