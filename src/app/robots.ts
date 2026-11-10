import type { MetadataRoute } from "next";

// Keep pages crawlable so search engines can read the noindex directives.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
  };
}
