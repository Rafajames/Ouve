import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect, test, type BrowserContext } from "@playwright/test";

/**
 * Teste de fumaça: carrega a extensão Chrome empacotada (dist/chrome) num Chromium real.
 * Captura de aba exige gesto real do usuário e não é exercitada aqui.
 */
const extensionPath = fileURLToPath(new URL("../dist/chrome", import.meta.url));
let context: BrowserContext;
let extensionId = "";

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "ouve-ext-")), {
    ...(process.env.OUVE_CHROME_PATH ? { executablePath: process.env.OUVE_CHROME_PATH } : {}),
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      ...(process.platform === "linux" ? ["--no-sandbox"] : [])
    ]
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => context?.close());

test("página do Ouve renderiza sem erros e informa o escopo somente áudio", async () => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${extensionId}/app.html`);
  await expect(page.getByText("Somente áudio. Nenhuma imagem é capturada.")).toBeVisible();
  await expect(page.getByText(/sem criptografia do sistema operacional/)).toBeVisible();
  const start = page.getByRole("button", { name: "Somente microfone" });
  await expect(start).toBeDisabled();
  await page.getByRole("checkbox", { name: /Confirmo que tenho autorização/ }).check();
  await expect(start).toBeEnabled();
  expect(errors).toEqual([]);
});

test("popup exige consentimento antes de capturar a aba", async () => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const capture = popup.getByRole("button", { name: "Capturar áudio desta aba" });
  await expect(capture).toBeDisabled();
  await popup.locator("#consent").check();
  await expect(capture).toBeEnabled();
});
