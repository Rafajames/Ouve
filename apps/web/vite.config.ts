import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Versão web: reaproveita as telas do desktop (apps/desktop/src/renderer) com a ponte web.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { alias: { "@": resolve(__dirname, "../desktop/src/renderer/src") } },
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  server: { port: 5180 },
  preview: { port: 5181 }
});
