import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { realpathSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig({
  // Codex workspaces on Windows can be exposed through a junction. Using the
  // canonical root keeps Rollup asset names relative and deployable.
  root: realpathSync("."),
  plugins: [react(), cloudflare()],
});
