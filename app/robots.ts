import type { MetadataRoute } from "next";
import { SITE_URL } from "./site";

// static export では out/robots.txt として書き出される。
// プロジェクトページ配信では出力先が /<slug>/robots.txt になり、クローラが読むのは
// origin 直下の /robots.txt だけなので sitemap の自動発見は効かない（クロールは既定で許可）。
// sitemap は Search Console から直接送信する。
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}sitemap.xml`,
  };
}
