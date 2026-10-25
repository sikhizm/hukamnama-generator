import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Sikhizm Hukamnama Studio",
    short_name: "Hukamnama",
    description: "Generate and share daily Hukamnama images, reels and stories.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0b10",
    theme_color: "#0a0b10",
    icons: [
      { src: "/icons/app-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/app-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
