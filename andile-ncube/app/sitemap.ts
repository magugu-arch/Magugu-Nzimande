import type { MetadataRoute } from "next";
import { episodes } from "@/data/episodes";
import { site } from "@/data/site";
import { stories } from "@/data/stories";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, site.url).toString();
  const pages = ["/", "/house", "/flagship", "/slate", "/partners", "/story", "/journal", "/press"];
  return [
    ...pages.map((p) => ({ url: url(p) })),
    // Placeholder episodes are noindex, so only published ones are listed.
    ...episodes.filter((e) => e.status === "published").map((e) => ({ url: url(`/flagship/${e.slug}`) })),
    ...stories.map((s) => ({ url: url(`/journal/${s.slug}`) })),
  ];
}
