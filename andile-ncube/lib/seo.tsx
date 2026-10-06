import type { Metadata } from "next";
import { getMedia } from "@/data/media";
import { site } from "@/data/site";
import type { MediaId } from "@/lib/types";

export const absoluteUrl = (path: string) => new URL(path, site.url).toString();

export function pageMetadata({
  title,
  description,
  path,
  image = "IMG_6889",
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: MediaId;
  noindex?: boolean;
}): Metadata {
  const asset = getMedia(image);
  const images = [{ url: asset.src, width: asset.width, height: asset.height, alt: asset.alt }];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} — ${site.name}`,
      description,
      url: path,
      siteName: site.name,
      type: "website",
      locale: "en_ZA",
      images,
    },
    twitter: { card: "summary_large_image", title: `${title} — ${site.name}`, description, images },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

/** Structured data, escaped so content can never close the script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export const personLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": absoluteUrl("/#andile"),
  name: site.name,
  jobTitle: "Broadcaster, host and storyteller",
  url: absoluteUrl("/"),
  image: absoluteUrl(getMedia("IMG_6891").src),
};

export const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": absoluteUrl("/#house"),
  name: site.property,
  url: absoluteUrl("/"),
  founder: { "@id": absoluteUrl("/#andile") },
  description: site.description,
};
