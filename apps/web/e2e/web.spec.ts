import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { startMockProvider, type MockProvider } from "../../desktop/e2e/mock-provider";
import { locateFfmpeg } from "../../desktop/src/main/media-service";

let mock: MockProvider;
const work = mkdtempSync(join(tmpdir(), "ouve-web-"));
const audio = join(work, "aula.wav");

test.beforeAll(async () => {
  execFileSync(locateFfmpeg(), ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=300:duration=6", "-ac", "1", audio]);
  mock = await startMockProvider();
});
test.afterAll(async () => mock?.close());

test("versão web: termo, provedor, importação, transcrição, análise e download", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Aceitar e começar" }).click();
  await expect(page.getByRole("heading", { name: "Conheça o Ouve" })).toBeVisible();
  await page.getByRole("button", { name: "Pular", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Cole sua chave de IA/ })).toBeVisible();
  await expect(page.getByText("A chave fica só nesta aba", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Provedores de IA", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar provedor" }).click();
  await page.getByLabel("Tipo", { exact: true }).selectOption("openai-compatible");
  await page.getByLabel("Nome", { exact: true }).fill("Servidor de teste");
  await page.getByLabel(/Endpoint/).fill(mock.url);
  await page.getByLabel("Modelo para análise/relatório").fill("mock-chat");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByLabel("Provedor de transcrição").selectOption({ label: "Servidor de teste" });
  await page.getByLabel("Provedor de análise").selectOption({ label: "Servidor de teste" });
  await page.getByRole("button", { name: "Testar conexão" }).click();
  await expect(page.getByText(/Conexão estabelecida/)).toBeVisible();

  await page.getByRole("button", { name: "Nova sessão", exact: true }).click();
  await expect(page.getByRole("radio", { name: /Aba ou tela/ })).toBeVisible();
  await expect(page.getByText(/Janelas avulsas não trazem áudio/)).toBeVisible();

  await page.getByRole("button", { name: "Importar arquivo", exact: true }).click();
  await expect(page.getByText(/até 300 MB e 2 h/)).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Escolher arquivo" }).click();
  await (await chooser).setFiles(audio);
  await expect(page.locator(".status-pill")).toHaveText(/Concluído/, { timeout: 60_000 });
  await expect(page.getByText(/Maria vai enviar o parecer/).first()).toBeVisible();

  // Marcadores e métricas locais (sem IA).
  await page.getByRole("button", { name: "Decisão", exact: true }).click();
  await page.getByRole("tab", { name: /Marcadores \(1\)/ }).click();
  await expect(page.locator(".marker-list li")).toHaveCount(1);
  await page.getByRole("tab", { name: /Métricas/ }).click();
  await expect(page.getByText("Linha do tempo — quem falou e quando")).toBeVisible();
  await expect(page.locator(".stage-list li").first()).toBeVisible();
  await page.getByRole("tab", { name: /Transcrição/ }).click();

  await page.getByRole("button", { name: "Analisar e gerar relatório" }).click();
  await expect(page.locator('input[value="Enviar parecer"]')).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  expect((await download).suggestedFilename()).toBe("aula.pdf");
  await page.getByText("Exportar e escolher o que incluir").click();
  const txt = page.waitForEvent("download");
  await page.getByRole("button", { name: "TXT", exact: true }).click();
  const txtFile = await (await txt).path();
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(txtFile!, "utf8");
  expect(content).toContain("MARCADORES REGISTRADOS");
  expect(content).toContain("PARTICIPAÇÃO");
  expect(errors).toEqual([]);
});

test("versão web: preferências ficam só no navegador e o termo não volta", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Aceitar e começar" }).click();
  await page.getByRole("button", { name: "Pular", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bem-vindo ao Ouve" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Conheça o Ouve" })).toHaveCount(0);
  const stored = await page.evaluate(() => Object.keys(localStorage));
  expect(stored).toContain("ouve.settings");
});
