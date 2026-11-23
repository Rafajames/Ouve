import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { locateFfmpeg } from "../src/main/media-service";
import { startMockProvider, type MockProvider } from "./mock-provider";

/**
 * Critério de aceite visual do redesign: nas resoluções de referência, as páginas
 * principais cabem na janela sem rolagem da página (só áreas internas rolam) e
 * nenhum controle fica cortado. Com OUVE_SHOTS=<pasta>, salva capturas de tela.
 */
const SIZES: Array<[number, number]> = [
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1920, 1080]
];
const PAGES: Array<{ nav: string; name: string }> = [
  { nav: "Início", name: "inicio" },
  { nav: "Nova reunião", name: "nova-reuniao" },
  { nav: "Importar arquivo", name: "importar" },
  { nav: "Relatórios", name: "relatorios" },
  { nav: "Provedores de IA", name: "provedores" },
  { nav: "Configurações", name: "configuracoes" },
  { nav: "Ajuda", name: "ajuda" }
];

let app: ElectronApplication;
let page: Page;
let mock: MockProvider;
const work = mkdtempSync(join(tmpdir(), "ouve-layout-"));
const audioFile = join(work, "reuniao.wav");
const shots = process.env.OUVE_SHOTS;

async function resize(width: number, height: number) {
  await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]?.setContentSize(w!, h!), [width, height]);
  await page.waitForFunction(([w, h]) => window.innerWidth === w && window.innerHeight === h, [width, height]);
}

/** Overflow vertical da página (não de áreas internas com rolagem própria). */
async function pageOverflow(): Promise<number> {
  return page.evaluate(() => {
    const doc = document.scrollingElement!;
    const main = document.querySelector<HTMLElement>(".main-scroll");
    const docOver = doc.scrollHeight - doc.clientHeight;
    const mainOver = main ? main.scrollHeight - main.clientHeight : 0;
    return Math.max(docOver, mainOver);
  });
}

async function snap(name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: join(shots, `${name}.png`) });
}

test.beforeAll(async () => {
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
      OUVE_E2E_SAVE_DIR: work
    }
  });
  page = await app.firstWindow();
  await page.getByRole("button", { name: "Aceitar e começar" }).click();
});

test.afterAll(async () => {
  await app?.close();
  await mock?.close();
  rmSync(work, { recursive: true, force: true });
});

test("páginas vazias cabem na tela nas resoluções de referência", async () => {
  for (const [w, h] of SIZES) {
    await resize(w, h);
    for (const p of PAGES) {
      await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: p.nav, exact: true }).click();
      await snap(`vazio-${p.name}-${w}x${h}`);
      if (p.name === "ajuda" || p.name === "configuracoes") continue; // conteúdo longo rola internamente por seção
      expect(await pageOverflow(), `${p.name} em ${w}×${h}`).toBeLessThanOrEqual(1);
    }
  }
});

test("com provedor, sessão e relatório, as páginas continuam cabendo", async () => {
  await resize(1366, 768);
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("button", { name: "Provedores de IA", exact: true })
    .click();
  await page.getByRole("button", { name: "Adicionar provedor" }).click();
  await page.getByLabel("Provedor", { exact: true }).selectOption("openai-compatible");
  await page.getByLabel("Nome", { exact: true }).fill("Servidor de teste");
  await page.getByLabel(/Endpoint/).fill(mock.url);
  await page.getByLabel("Modelo para análise/relatório").fill("mock-chat");
  await page.getByLabel("Modelo para transcrição").fill("mock-transcribe");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByLabel("Provedor de transcrição").selectOption({ label: "Servidor de teste" });
  await page.getByLabel("Provedor de análise").selectOption({ label: "Servidor de teste" });
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("button", { name: "Importar arquivo", exact: true })
    .click();
  await page.getByRole("button", { name: "Escolher arquivo" }).click();
  await expect(page.locator(".status-pill")).toHaveText(/Concluído/, { timeout: 60_000 });
  await page.getByRole("button", { name: "Analisar e gerar relatório" }).click();
  await page.getByRole("tab", { name: /Tarefas/ }).click();
  await expect(page.locator('input[value="Enviar parecer"]')).toBeVisible();
  await snap("relatorio-tarefas-1366x768");
  await page.getByRole("tab", { name: /Resumo/ }).click();
  await snap("relatorio-resumo-1366x768");

  for (const [w, h] of SIZES) {
    await resize(w, h);
    for (const p of PAGES) {
      await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: p.nav, exact: true }).click();
      await snap(`cheio-${p.name}-${w}x${h}`);
      if (p.name === "ajuda" || p.name === "configuracoes") continue;
      expect(await pageOverflow(), `${p.name} em ${w}×${h}`).toBeLessThanOrEqual(1);
    }
    await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: "Sessão atual", exact: true }).click();
    await snap(`cheio-sessao-${w}x${h}`);
    expect(await pageOverflow(), `sessão em ${w}×${h}`).toBeLessThanOrEqual(1);
  }

  // Tema escuro: mesmas páginas, mesmo critério.
  await resize(1366, 768);
  await page.getByRole("button", { name: "Tema escuro" }).click();
  for (const p of PAGES) {
    await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: p.nav, exact: true }).click();
    await snap(`escuro-${p.name}-1366x768`);
    if (p.name === "ajuda" || p.name === "configuracoes") continue;
    expect(await pageOverflow(), `${p.name} (escuro)`).toBeLessThanOrEqual(1);
  }
  await page.getByRole("button", { name: "Seguir o sistema" }).click();
});
