import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base "/sea-guard-ai/" ΜΟΝΟ για GitHub Pages build (GH_PAGES=1)·
// τοπικό dev + tunnel (server.cjs σερβίρει στο root) → base "/".
export default defineConfig({
  base: process.env.GH_PAGES ? "/sea-guard-ai/" : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["sea-guard.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png"],
      manifest: {
        name: "EV SEA GUARD AI — Λαγοκέφαλος",
        short_name: "Sea Guard AI",
        description: "Χάρτης κινδύνου λαγοκέφαλου σε όλη την Ελλάδα με πραγματικά δεδομένα θάλασσας.",
        lang: "el",
        theme_color: "#0b3d4d",
        background_color: "#03162e",
        display: "standalone",
        orientation: "any",
        categories: ["health", "weather", "utilities"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "sea-guard.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,json}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /open-meteo\.com|gbif\.org/.test(url.origin),
            handler: "NetworkFirst",
            options: { cacheName: "sea-data", expiration: { maxEntries: 60, maxAgeSeconds: 3600 } },
          },
          {
            urlPattern: ({ url }) => /tile\.openstreetmap\.org/.test(url.origin),
            handler: "CacheFirst",
            options: { cacheName: "osm-tiles", expiration: { maxEntries: 300, maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: ({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url.origin),
            handler: "CacheFirst",
            options: { cacheName: "google-fonts", expiration: { maxEntries: 30, maxAgeSeconds: 604800 } },
          },
        ],
      },
    }),
  ],
});
