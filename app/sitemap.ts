import type { MetadataRoute } from "next";
import { lastContentChange, site } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: site.url,
      lastModified: lastContentChange,
    },
  ];
}
