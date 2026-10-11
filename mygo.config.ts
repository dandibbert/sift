import { defineConfig } from "mygo-cli";

export default defineConfig({
  name: "Sift",
  identifier: "dev.sift.app",
  version: "0.1.0",
  copyright: "© 2026 Sift",
  macos: {
    // A menu bar app: no Dock icon, not even while it launches.
    infoPlist: {
      LSUIElement: true,
      LSApplicationCategoryType: "public.app-category.productivity",
    },
  },
  // `mygo dev` runs devCommand and loads devUrl; `mygo build` runs
  // buildCommand and embeds frontendDist into the app.
  devUrl: "http://127.0.0.1:47218",
  devCommand: "bun run dev:web",
  buildCommand: "bun run build:web",
  frontendDist: "dist",
  bindings: "src/mygo.ts",
  out: "build",
});
