import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/common",
    emptyOutDir: true,
    // Sem polyfill inline: a CSP do MV3 só permite scripts do próprio pacote.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        app: resolve(__dirname, "app.html"),
        background: resolve(__dirname, "src/background.ts")
      },
      output: { entryFileNames: "[name].js", chunkFileNames: "chunks/[name]-[hash].js", assetFileNames: "assets/[name]-[hash][extname]" }
    }
  },
  publicDir: false
});
