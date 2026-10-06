import Image from "next/image";
import { getMedia } from "@/data/media";
import type { MediaId } from "@/lib/types";

type Props = {
  id: MediaId;
  /** Required: what the image's rendered width is at each breakpoint. */
  sizes: string;
  className?: string;
  imgClassName?: string;
  /** Only for the one image that is the page's largest paint. */
  preload?: boolean;
  quality?: 75 | 85;
  /** Decorative images that repeat information already in text. */
  decorative?: boolean;
  /** Overrides the asset's default focal point. */
  focus?: string;
  /** Marks the image for the scroll-linked scale / parallax in <Motion>. */
  motion?: "scale" | "parallax";
};

/**
 * A cropped, responsive image that fills its box. The box sets the aspect
 * ratio (via className), so layout never shifts while the image loads.
 */
export function Media({
  id,
  sizes,
  className = "",
  imgClassName = "",
  preload = false,
  quality = 75,
  decorative = false,
  focus,
  motion,
}: Props) {
  const asset = getMedia(id);
  return (
    <div className={`relative overflow-hidden bg-charcoal ${className}`}>
      <Image
        src={asset.src}
        alt={decorative ? "" : asset.alt}
        fill
        sizes={sizes}
        quality={quality}
        preload={preload}
        loading={preload ? "eager" : "lazy"}
        className={`object-cover ${motion ? "will-change-transform" : ""} ${imgClassName}`}
        style={{ objectPosition: focus ?? asset.focus }}
        data-scale={motion === "scale" ? "" : undefined}
        data-parallax={motion === "parallax" ? "" : undefined}
      />
    </div>
  );
}
