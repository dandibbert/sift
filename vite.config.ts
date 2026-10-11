import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const apiPort = process.env.SIFT_PREVIEW_PORT ?? "47219";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    // mygo.config.ts points devUrl here.
    host: "127.0.0.1",
    port: 47218,
    strictPort: true,
    watch: { ignored: ["**/.mygo/**", "**/build/**"] },
    // In a plain browser tab there is no MyGo runtime: the page talks to
    // cmd/sift-preview over HTTP instead.
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
