import type { MetadataRoute } from "next";
import { SITE_URL } from "./site";

// static export では out/sitemap.xml として書き出される。
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: "monthly", priority: 1 }];
}
