import type { MetadataRoute } from "next";

// PWA manifest (§14.3 step 1) — installable home-screen icon on top of the
// existing web app. No native shell, no store review; the offline shell is
// the service worker already built for the clock-in queue (§6.2).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Skifta",
    short_name: "Skifta",
    description: "Schema, stämpelklocka och löneklara timmar för små restauranger.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f1eee7",
    theme_color: "#2c6a5e",
    lang: "sv",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
