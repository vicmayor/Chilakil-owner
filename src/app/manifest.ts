import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chilakil Owner",
    short_name: "Chilakil",
    description: "Owner app for Chilakil To Go — Glendale and Avondale, tracked separately.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f3ece3",
    theme_color: "#b1321c",
    lang: "en",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
