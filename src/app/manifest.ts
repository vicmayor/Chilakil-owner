import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chilakil Owner",
    short_name: "Chilakil",
    description: "Owner app for Chilakil To Go — Glendale and Avondale, tracked separately.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "en",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
