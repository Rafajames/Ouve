import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { locateFfmpeg } from "../src/main/media-service";

/** Item do menu lateral (evita colidir com links de mesmo nome dentro da página). */
const nav = (p: Page, name: string) =>
  p.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name, exact: true });
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

test("pede o termo de uso só no primeiro uso", async () => {
  await expect(page.getByRole("heading", { name: "Bem-vindo ao Ouve" })).toBeVisible();
  await expect(page.getByText(/informar os participantes/)).toBeVisible();
  await expect(page.getByText("Idealizado e desenvolvido por Rafajames")).toBeVisible();
  await page.getByRole("button", { name: "Aceitar e começar" }).click();
  await expect(page.getByRole("heading", { name: "Bem-vindo ao Ouve" })).toHaveCount(0);
  await expect.poll(() => readFileSync(join(work, "userdata", "settings.json"), "utf8")).toContain('"termsAcceptedVersion": 2');
});

test("tela inicial explica o produto sem prometer captura de vídeo", async () => {
  await expect(page.getByRole("button", { name: /Nova reunião/ }).first()).toBeVisible();
  await expect(page.getByText(/somente o áudio — nunca grava a tela/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Cole sua chave de IA/ })).toBeVisible();
});

test("alterna o tema e mantém a preferência", async () => {
  await page.getByRole("button", { name: "Tema claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Tema escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Seguir o sistema" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
});

test("configura provedor compatível local e testa a conexão", async () => {
  await nav(page, "Provedores de IA").click();
  await page.getByRole("button", { name: "Adicionar provedor" }).click();
  await page.getByLabel("Provedor", { exact: true }).selectOption("openai-compatible");
  await page.getByLabel("Nome", { exact: true }).fill("Servidor de teste");
  await page.getByLabel(/Endpoint/).fill(mock.url);
  await page.getByLabel("Modelo para análise/relatório").fill("mock-chat");
  await page.getByLabel("Modelo para transcrição").fill("mock-transcribe");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".provider-name", { hasText: "Servidor de teste" })).toBeVisible();
  await page.getByLabel("Provedor de transcrição").selectOption({ label: "Servidor de teste" });
  await page.getByLabel("Provedor de análise").selectOption({ label: "Servidor de teste" });
  await page.getByRole("button", { name: "Testar conexão" }).click();
  await expect(page.getByText(/Conexão estabelecida/)).toBeVisible();
  expect(mock.requests.some((r) => r.path === "/v1/models")).toBe(true);
});

test("nova sessão não pede termo de novo e lista fontes sem miniaturas", async () => {
  await nav(page, "Nova reunião").click();
  const start = page.getByRole("button", { name: "Iniciar captura de áudio" });
  await expect(page.getByText(/descarta a imagem e processa somente o som/)).toBeVisible();
  await expect(page.locator("img")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /autorização/ })).toHaveCount(0);
  await page.getByRole("radio", { name: /Somente microfone/ }).click();
  await expect(start).toBeEnabled();
});

test("importa áudio, transcreve, analisa com validação e exporta PDF/DOCX", async () => {
  await nav(page, "Importar arquivo").click();
  await page.getByRole("button", { name: "Escolher arquivo" }).click();
  await expect(page.locator(".status-pill")).toHaveText(/Concluído/, { timeout: 60_000 });
  await expect(page.getByText(/Maria vai enviar o parecer/).first()).toBeVisible();
  expect(mock.requests.filter((r) => r.path === "/v1/audio/transcriptions").length).toBeGreaterThan(0);

  // Sessão em tela única: a página não rola; só a lista de falas rola (1366×768 e 1280×720).
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1280, height: 720 }
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    const layout = await page.evaluate(() => {
      const content = document.querySelector(".content") as HTMLElement;
      const transcript = document.querySelector(".transcript-panel") as HTMLElement;
      return {
        pageScrolls: content.scrollHeight > content.clientHeight + 1,
        transcriptScrolls: transcript.scrollHeight > transcript.clientHeight
      };
    });
    expect(layout, `${size.width}x${size.height}`).toEqual({ pageScrolls: false, transcriptScrolls: true });
  }
  if (process.env.OUVE_E2E_SCREENSHOTS) await page.screenshot({ path: join(process.env.OUVE_E2E_SCREENSHOTS, "sessao.png") });

  await page.getByRole("button", { name: "Analisar e gerar relatório" }).click();
  await expect(page.getByText(/aviso\(s\) do validador/)).toBeVisible();
  await page.getByRole("tab", { name: /Tarefas/ }).click();
  await expect(page.locator("input.item-title").first()).toBeVisible();
  await expect(page.locator('input[value="Enviar parecer"]')).toBeVisible();
  await expect(page.locator('input[aria-label="Responsável"][value="Maria"]')).toBeVisible();
  // "Pedro" não aparece na transcrição: o validador remove o responsável inventado.
  await expect(page.locator('input[aria-label="Responsável"][value="Pedro"]')).toHaveCount(0);
  if (process.env.OUVE_E2E_SCREENSHOTS)
    await page.screenshot({ path: join(process.env.OUVE_E2E_SCREENSHOTS, "relatorio.png"), fullPage: true });

  await page.getByRole("button", { name: "Exportar PDF" }).click();
  await expect(page.getByText(/Relatório salvo em/)).toBeVisible();
  await page.getByRole("button", { name: "Exportar DOCX" }).click();
  await expect.poll(() => readdirSync(saveDir).sort()).toEqual(["audiencia.docx", "audiencia.pdf"]);
  expect(readFileSync(join(saveDir, "audiencia.pdf")).subarray(0, 5).toString()).toBe("%PDF-");
});

test("descarta a sessão e não deixa conteúdo salvo no perfil", async () => {
  await nav(page, "Sessão atual").click();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Descartar sessão" }).click();
  await expect(page.getByRole("heading", { name: "Relatórios recentes" })).toBeVisible();
  await expect(nav(page, "Sessão atual")).toHaveCount(0);
  const userData = join(work, "userdata");
  const stored = existsSync(join(userData, "providers.json")) ? readFileSync(join(userData, "providers.json"), "utf8") : "";
  expect(stored).not.toContain("Maria");
  expect(readFileSync(join(userData, "settings.json"), "utf8")).not.toContain("Maria");
});

test("relatórios desta execução: lista, pesquisa, abre e exclui (só memória)", async () => {
  await nav(page, "Relatórios").click();
  const row = page.locator("tbody tr", { hasText: "audiencia" });
  await expect(row).toBeVisible();
  await expect(row.getByText(/Exportado \(PDF, DOCX\)/)).toBeVisible();
  await page.getByLabel("Pesquisar relatórios").fill("nada-disso");
  await expect(page.getByText("Nada encontrado")).toBeVisible();
  await page.getByLabel("Pesquisar relatórios").fill("audi");
  await row.getByRole("button", { name: "Abrir audiencia" }).click();
  await expect(page.getByText(/Guardado nesta execução/)).toBeVisible();
  await page.getByRole("tab", { name: /Tarefas/ }).click();
  await expect(page.locator('input[value="Enviar parecer"]')).toBeVisible();
  await page.getByRole("button", { name: "Relatórios" }).first().click();
  page.once("dialog", (d) => void d.accept());
  await page.locator("tbody tr", { hasText: "audiencia" }).getByRole("button", { name: "Excluir audiencia" }).click();
  await expect(page.getByText("Nenhum relatório nesta execução")).toBeVisible();
});
