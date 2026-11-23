import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5181",
    ...(process.env.OUVE_CHROME_PATH ? { launchOptions: { executablePath: process.env.OUVE_CHROME_PATH } } : {})
  },
  webServer: {
    command: "pnpm exec vite preview --host 127.0.0.1 --port 5181 --strictPort",
    url: "http://127.0.0.1:5181",
    reuseExistingServer: false
  }
});
