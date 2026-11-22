import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

// Pacotes do workspace são TypeScript-fonte: precisam ser empacotados, não externalizados.
const workspace = [
  "@ouve/core",
  "@ouve/shared",
  "@ouve/capture",
  "@ouve/providers",
  "@ouve/transcription",
  "@ouve/analysis",
  "@ouve/reports"
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspace })],
    // Commit do build (GitHub Actions define GITHUB_SHA); usado para verificar atualizações.
    define: { __OUVE_BUILD__: JSON.stringify((process.env.GITHUB_SHA ?? "dev").slice(0, 7)) },
    build: { rollupOptions: { input: resolve(__dirname, "src/main/index.ts") } }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: workspace })],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "src/preload/index.ts"),
        // Preload com sandbox ativo precisa ser CommonJS.
        output: { format: "cjs", entryFileNames: "[name].cjs" }
      }
    }
  },
  renderer: {
    resolve: { alias: { "@": resolve(__dirname, "src/renderer/src") } },
    plugins: [react()],
    root: resolve(__dirname, "src/renderer"),
    build: { rollupOptions: { input: resolve(__dirname, "src/renderer/index.html") } }
  }
});
