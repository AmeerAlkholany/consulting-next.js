import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/consultants", "/crisis-resources", "/legal/*"],
        disallow: ["/admin/*", "/consultant/*", "/appointments/*", "/api/*"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
