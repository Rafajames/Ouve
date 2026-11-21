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

test("pede o termo uma vez e depois libera a captura sem nova confirmação", async () => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${extensionId}/app.html`);
  await expect(page.getByRole("heading", { name: "Bem-vindo ao Ouve" })).toBeVisible();
  await page.getByRole("button", { name: "Aceitar e começar" }).click();
  await expect(page.getByText("Somente áudio. Nenhuma imagem é capturada.")).toBeVisible();
  await expect(page.getByText(/sem criptografia do sistema operacional/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Somente microfone/ })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bem-vindo ao Ouve" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("popup libera a captura da aba após o aceite, sem caixa de confirmação", async () => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator("#consent")).toHaveCount(0);
  await expect(popup.getByRole("button", { name: "Capturar áudio desta aba" })).toBeEnabled();
});
