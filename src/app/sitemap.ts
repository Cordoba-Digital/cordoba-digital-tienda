import type { MetadataRoute } from "next";

import { getCategories, listProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

const BASE = "https://www.cordobadigital.net";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/productos`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/ayuda`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/seguimiento`, changeFrequency: "monthly", priority: 0.4 },
  ];

  try {
    const [categories, products] = await Promise.all([getCategories(), listProducts({ perPage: 200 })]);
    return [
      ...staticRoutes,
      ...categories.map((category) => ({
        url: `${BASE}/productos?categoria=${category.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...products.items.map((product) => ({
        url: `${BASE}/producto/${product.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
