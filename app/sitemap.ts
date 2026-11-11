import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { db } from "@/db/client";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = ["", "/consultants", "/crisis-resources", "/legal/privacy", "/legal/terms"].map(
    (route) => ({
      url: `${siteConfig.url}${route}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: route === "" ? 1 : 0.8,
    }),
  );

  try {
    const consultants = await db.consultantProfile.findMany({
      where: {
        verificationStatus: "APPROVED",
        isAcceptingBookings: true,
        user: { status: "ACTIVE", deletedAt: null },
      },
      select: { slug: true, updatedAt: true },
      take: 1000,
    });

    const consultantRoutes = consultants.map((c) => ({
      url: `${siteConfig.url}/consultants/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    return [...routes, ...consultantRoutes];
  } catch (_e) {
    return routes;
  }
}
