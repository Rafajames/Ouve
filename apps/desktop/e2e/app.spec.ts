import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { locateFfmpeg } from "../src/main/media-service";
import { startMockProvider, type MockProvider } from "./mock-provider";

let app: ElectronApplication;
let page: Page;
let mock: MockProvider;
const work = mkdtempSync(join(tmpdir(), "ouve-e2e-"));
const saveDir = join(work, "exports");
const audioFile = join(work, "audiencia.wav");

test.beforeAll(async () => {
  execFileSync("mkdir", ["-p", saveDir]);
  execFileSync(locateFfmpeg(), ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=300:duration=6", "-ac", "1", audioFile]);
  mock = await startMockProvider();
  const args = [resolve(fileURLToPath(new URL("../out/main/index.js", import.meta.url)))];
  if (process.platform === "linux") args.push("--no-sandbox");
  app = await electron.launch({
    args,
    env: {
      ...process.env,
      OUVE_E2E: "1",
      OUVE_E2E_USER_DATA: join(work, "userdata"),
      OUVE_E2E_OPEN_FILE: audioFile,
      OUVE_E2E_SAVE_DIR: saveDir
    }
  });
  page = await app.firstWindow();
});

test.afterAll(async () => {
  await app?.close();
  await mock?.close();
  rmSync(work, { recursive: true, force: true });
});

test("tela inicial explica o produto sem prometer captura de vídeo", async () => {
  await expect(page.getByRole("heading", { name: "Transforme conversas em informação" })).toBeVisible();
  await expect(page.getByText("O Ouve usa somente o áudio — nunca grava a tela.")).toBeVisible();
  await expect(page.getByText("Primeiro passo:")).toBeVisible();
});

test("configura provedor compatível local e testa a conexão", async () => {
  await page.getByRole("button", { name: "Provedores de IA", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar provedor" }).click();
  await page.getByLabel("Tipo", { exact: true }).selectOption("openai-compatible");
  await page.getByLabel("Nome", { exact: true }).fill("Servidor de teste");
  await page.getByLabel(/Endpoint/).fill(mock.url);
  await page.getByLabel("Modelo para análise/relatório").fill("mock-chat");
  await page.getByLabel("Modelo para transcrição").fill("mock-transcribe");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".provider strong", { hasText: "Servidor de teste" })).toBeVisible();
  await page.getByLabel("Provedor de transcrição").selectOption({ label: "Servidor de teste" });
  await page.getByLabel("Provedor de análise").selectOption({ label: "Servidor de teste" });
  await page.getByRole("button", { name: "Testar conexão" }).click();
  await expect(page.getByText(/Conexão estabelecida/)).toBeVisible();
  expect(mock.requests.some((r) => r.path === "/v1/models")).toBe(true);
});

test("nova sessão exige consentimento e lista fontes sem miniaturas", async () => {
  await page.getByRole("button", { name: "Nova sessão", exact: true }).click();
  const start = page.getByRole("button", { name: "Iniciar captura de áudio" });
  await expect(start).toBeDisabled();
  await expect(page.getByText(/descarta a imagem e processa somente o som/)).toBeVisible();
  await expect(page.locator("img")).toHaveCount(0);
  await page.getByRole("radio", { name: /Somente microfone/ }).click();
  await expect(start).toBeDisabled();
  await page.getByRole("checkbox", { name: /Confirmo que tenho autorização/ }).check();
  await expect(start).toBeEnabled();
});

test("importa áudio, transcreve, analisa com validação e exporta PDF/DOCX", async () => {
  await page.getByRole("button", { name: "Importar arquivo", exact: true }).click();
  await page.getByRole("checkbox", { name: /Confirmo que tenho autorização/ }).check();
  await page.getByRole("button", { name: "Escolher arquivo" }).click();
  await expect(page.locator(".status-pill")).toHaveText(/Concluído/, { timeout: 60_000 });
  await expect(page.getByText(/Maria vai enviar o parecer/).first()).toBeVisible();
  expect(mock.requests.filter((r) => r.path === "/v1/audio/transcriptions").length).toBeGreaterThan(0);
  if (process.env.OUVE_E2E_SCREENSHOTS) await page.screenshot({ path: join(process.env.OUVE_E2E_SCREENSHOTS, "sessao.png") });

  await page.getByRole("button", { name: "Analisar e gerar relatório" }).click();
  await expect(page.locator("input.item-title").first()).toBeVisible();
  await expect(page.locator('input[value="Enviar parecer"]')).toBeVisible();
  await expect(page.locator('input[aria-label="Responsável"][value="Maria"]')).toBeVisible();
  // "Pedro" não aparece na transcrição: o validador remove o responsável inventado.
  await expect(page.locator('input[aria-label="Responsável"][value="Pedro"]')).toHaveCount(0);
  await expect(page.getByText(/aviso\(s\) do validador/)).toBeVisible();
  if (process.env.OUVE_E2E_SCREENSHOTS)
    await page.screenshot({ path: join(process.env.OUVE_E2E_SCREENSHOTS, "relatorio.png"), fullPage: true });

  await page.getByRole("button", { name: "Exportar PDF" }).click();
  await expect(page.getByText(/Relatório salvo em/)).toBeVisible();
  await page.getByRole("button", { name: "Exportar DOCX" }).click();
  await expect.poll(() => readdirSync(saveDir).sort()).toEqual(["audiencia.docx", "audiencia.pdf"]);
  expect(readFileSync(join(saveDir, "audiencia.pdf")).subarray(0, 5).toString()).toBe("%PDF-");
});

test("descarta a sessão e não deixa conteúdo salvo no perfil", async () => {
  await page.getByRole("button", { name: "Sessão atual", exact: true }).click();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Descartar sessão" }).click();
  await expect(page.getByRole("heading", { name: "Transforme conversas em informação" })).toBeVisible();
  const userData = join(work, "userdata");
  const stored = existsSync(join(userData, "providers.json")) ? readFileSync(join(userData, "providers.json"), "utf8") : "";
  expect(stored).not.toContain("Maria");
  expect(existsSync(join(userData, "settings.json"))).toBe(true);
});
