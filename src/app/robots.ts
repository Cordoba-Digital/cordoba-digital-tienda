import type { MetadataRoute } from "next";

import { url } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/checkout", "/pedido/", "/api/"],
      },
    ],
    sitemap: url("/sitemap.xml"),
  };
}
