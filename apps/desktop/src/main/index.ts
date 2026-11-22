import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, safeStorage, session, shell, type IpcMainInvokeEvent } from "electron";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createLogger, toOuveError } from "@ouve/shared";
import type { CompletionRequest } from "@ouve/core";
import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS } from "@ouve/core";
import { IPC, type DesktopSource, type IpcResult, type SaveProviderInput } from "../shared/ipc.js";
import { MediaService } from "./media-service.js";
import { RELEASE_PAGE, UpdateService } from "./update-service.js";
import { spawn } from "node:child_process";

declare const __OUVE_BUILD__: string;
import { ProviderService } from "./provider-service.js";
import { SafeStorageSecretStore, SettingsStore } from "./stores.js";
import { assertNumber, assertString, parseProviderConfig, parseSettings } from "./validate.js";

const log = createLogger("main");
const E2E = process.env.OUVE_E2E === "1";
if (E2E && process.env.OUVE_E2E_USER_DATA) app.setPath("userData", process.env.OUVE_E2E_USER_DATA);

let mainWindow: BrowserWindow | null = null;
let pendingSourceId: string | null = null;
let settingsStore: SettingsStore;
let providers: ProviderService;
const media = new MediaService();

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  return mainWindow !== null && event.sender === mainWindow.webContents;
}

/** Registra um handler com verificação de origem e erros serializáveis. */
function handle<T>(channel: string, fn: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<T> | T): void {
  ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<T>> => {
    if (!isTrustedSender(event))
      return { ok: false, error: { code: "permission-denied", message: "Origem não autorizada.", retryable: false } };
    try {
      return { ok: true, value: await fn(event, ...args) };
    } catch (error) {
      const e = toOuveError(error);
      if (e.code === "internal") log.error("Falha em handler IPC.", { channel });
      return { ok: false, error: { code: e.code, message: e.message, retryable: e.retryable } };
    }
  });
}

function rendererUrlAllowed(url: string): boolean {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  return url.startsWith("file://") || (!!devUrl && url.startsWith(devUrl));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "Ouve",
    backgroundColor: "#0f1115",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => (mainWindow = null));

  // Navegação externa abre no navegador padrão; o app não navega para fora.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!rendererUrlAllowed(url)) event.preventDefault();
  });

  if (process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
}

function configureSession(): void {
  const ses = session.defaultSession;
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "media-src 'self' blob:",
    // O renderer não fala com a internet: chamadas de IA saem do processo principal.
    `connect-src 'self'${process.env.ELECTRON_RENDERER_URL ? " ws: http://localhost:*" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'"
  ].join("; ");
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [csp] } });
  });

  // Somente mídia (áudio/vídeo para o seletor) é permitida, e só para o renderer do Ouve.
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === "media" && webContents === mainWindow?.webContents);
  });
  ses.setPermissionCheckHandler((webContents, permission) => permission === "media" && webContents === mainWindow?.webContents);

  /**
   * getDisplayMedia no renderer chega aqui. Usamos a fonte escolhida no seletor
   * do Ouve. No Windows, o áudio é loopback do sistema. A trilha de vídeo é
   * exigida pela API e descartada imediatamente no renderer (selectAudioTracks).
   */
  ses.setDisplayMediaRequestHandler(
    (_request, callback) => {
      const id = pendingSourceId;
      pendingSourceId = null;
      if (!id) return callback({});
      void desktopCapturer
        .getSources({ types: ["screen", "window"], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false })
        .then((sources) => {
          const source = sources.find((s) => s.id === id);
          if (!source) return callback({});
          callback(process.platform === "win32" ? { video: source, audio: "loopback" } : { video: source });
        })
        .catch(() => callback({}));
    },
    { useSystemPicker: false }
  );
}

function registerIpc(): void {
  handle(IPC.listSources, async (): Promise<DesktopSource[]> => {
    // Sem miniaturas: o Ouve não captura nem exibe imagens das telas.
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false
    });
    return sources
      .filter((s) => !s.name.startsWith("Ouve"))
      .map((s) => ({ id: s.id, name: s.name || "Sem título", kind: s.id.startsWith("screen:") ? "screen" : "window" }));
  });
  handle(IPC.selectSource, (_e, id) => {
    pendingSourceId = assertString(id, "fonte", 200);
  });
  handle(IPC.setCaptureActive, (_e, active) => {
    // Indicador persistente fora da área do app: título e barra de tarefas.
    mainWindow?.setTitle(active ? "● Capturando áudio — Ouve" : "Ouve");
    if (process.platform === "win32") mainWindow?.flashFrame(false);
    mainWindow?.setProgressBar(active ? 2 : -1, { mode: active ? "indeterminate" : "none" });
  });

  handle(IPC.getSettings, () => settingsStore.getSettings());
  handle(IPC.saveSettings, (_e, raw) => settingsStore.saveSettings(parseSettings(raw)));

  handle(IPC.listProviders, () => providers.list());
  handle(IPC.saveProvider, (_e, raw) => {
    const input = raw as SaveProviderInput;
    const parsed: SaveProviderInput = { config: parseProviderConfig(input?.config) };
    if (input?.apiKey !== undefined) parsed.apiKey = assertString(input.apiKey, "chave", 500);
    return providers.save(parsed);
  });
  handle(IPC.removeProvider, (_e, id) => providers.remove(assertString(id, "id", 80)));
  handle(IPC.testProvider, (_e, id) => providers.test(assertString(id, "id", 80)));
  handle(IPC.secretProtection, () => ({ protection: secretStore.protection }));
  handle(IPC.quickSetup, (_e, key) => providers.quickSetup(assertString(key, "chave", 500)));

  handle(IPC.transcribe, async (_e, raw) => {
    const r = raw as Record<string, unknown>;
    if (!(r?.audio instanceof ArrayBuffer) && !ArrayBuffer.isView(r?.audio)) throw new Error("Áudio inválido.");
    const audio = r.audio instanceof ArrayBuffer ? new Uint8Array(r.audio) : new Uint8Array((r.audio as Uint8Array).buffer);
    if (audio.byteLength > 30 * 1024 * 1024) throw new Error("Bloco de áudio grande demais.");
    const result = await providers.transcribe(assertString(r.requestId, "requestId", 100), assertString(r.providerId, "provedor", 80), {
      audio,
      mimeType: assertString(r.mimeType, "mime", 100),
      durationMs: assertNumber(r.durationMs, "duração", 0, 3_600_000),
      ...(typeof r.language === "string" ? { language: r.language.slice(0, 10) } : {}),
      ...(typeof r.previousText === "string" ? { previousText: r.previousText.slice(-2000) } : {})
    });
    return result;
  });
  handle(IPC.complete, (_e, raw) => {
    const r = raw as { requestId?: unknown; providerId?: unknown; request?: CompletionRequest };
    if (!r?.request || !Array.isArray(r.request.messages)) throw new Error("Requisição inválida.");
    return providers.complete(assertString(r.requestId, "requestId", 100), assertString(r.providerId, "provedor", 80), {
      messages: r.request.messages
        .slice(0, 10)
        .map((m) => ({ role: m.role === "system" ? "system" : "user", content: assertString(m.content, "conteúdo", 2_000_000) })),
      json: !!r.request.json,
      ...(typeof r.request.temperature === "number" ? { temperature: r.request.temperature } : {}),
      ...(typeof r.request.maxOutputTokens === "number" ? { maxOutputTokens: r.request.maxOutputTokens } : {})
    });
  });
  handle(IPC.cancel, (_e, id) => providers.cancel(assertString(id, "requestId", 100)));

  handle(IPC.openMedia, async () => {
    const settings = await settingsStore.getSettings();
    const limits = { maxFileBytes: settings.maxFileGb * 1024 ** 3, maxDurationMs: settings.maxHours * 3_600_000 };
    let path: string | undefined;
    if (E2E && process.env.OUVE_E2E_OPEN_FILE) path = process.env.OUVE_E2E_OPEN_FILE;
    else {
      const result = await dialog.showOpenDialog(mainWindow as BrowserWindow, {
        title: "Importar gravação",
        properties: ["openFile"],
        filters: [
          { name: "Áudio e vídeo", extensions: [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS] },
          { name: "Áudio", extensions: [...AUDIO_EXTENSIONS] },
          { name: "Vídeo (somente o áudio será usado)", extensions: [...VIDEO_EXTENSIONS] }
        ]
      });
      path = result.canceled ? undefined : result.filePaths[0];
    }
    return path ? media.register(path, limits) : null;
  });
  handle(IPC.extractMedia, (event, token, seconds, format) =>
    media.extract(
      assertString(token, "token", 100),
      assertNumber(seconds, "segmento", 10, 1800),
      (ms) => event.sender.send(IPC.mediaProgress, token, ms),
      format === "mp3" ? "mp3" : "wav"
    )
  );
  handle(IPC.readSegment, async (_e, token, index) => {
    const bytes = await media.readSegment(assertString(token, "token", 100), assertNumber(index, "índice", 0, 100_000));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  });
  handle(IPC.releaseMedia, (_e, token) => media.release(assertString(token, "token", 100)));

  handle(IPC.checkUpdates, () => updates.check());
  handle(IPC.installUpdate, async (event) => {
    if (process.platform !== "win32") {
      await shell.openExternal(RELEASE_PAGE);
      return;
    }
    await updates.install((percent) => event.sender.send(IPC.updateProgress, percent));
  });

  handle(IPC.saveFile, async (_e, name, bytes) => {
    const fileName = assertString(name, "nome", 200).replace(/[\\/:*?"<>|]/g, "_");
    if (!(bytes instanceof Uint8Array)) throw new Error("Conteúdo inválido.");
    let target: string | undefined;
    if (E2E && process.env.OUVE_E2E_SAVE_DIR) target = join(process.env.OUVE_E2E_SAVE_DIR, fileName);
    else {
      const result = await dialog.showSaveDialog(mainWindow as BrowserWindow, { title: "Salvar relatório", defaultPath: fileName });
      target = result.canceled ? undefined : result.filePath;
    }
    if (!target) return null;
    await writeFile(target, bytes);
    return target;
  });
}

let secretStore: SafeStorageSecretStore;

// Atualização manual: só roda quando o usuário pede (D-070).
const updates = new UpdateService({
  fetch: (input, init) => fetch(input, init),
  currentBuild: __OUVE_BUILD__,
  launchInstaller: (path) => {
    spawn(path, [], { detached: true, stdio: "ignore" }).unref();
    setTimeout(() => app.quit(), 500);
  }
});

app.whenReady().then(() => {
  const dir = app.getPath("userData");
  settingsStore = new SettingsStore(dir);
  secretStore = new SafeStorageSecretStore(join(dir, "credentials.json"), safeStorage);
  providers = new ProviderService(settingsStore, secretStore);
  configureSession();
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Descarte de dados temporários ao encerrar.
app.on("before-quit", () => {
  providers?.cancelAll();
  void media.releaseAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
