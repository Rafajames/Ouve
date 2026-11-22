import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { LOCAL_WHISPER_PORT, WHISPER_MODELS, type WhisperModelName } from "@ouve/providers";
import { OuveError } from "@ouve/shared";

/**
 * IA local gerenciada pelo Ouve (D-082):
 * - transcrição: servidor do whisper.cpp embutido no instalador (compilado no CI a partir
 *   de uma versão fixa, licença MIT); o usuário só baixa o modelo, com um clique;
 * - análise: baixa o instalador oficial do Ollama e o abre — a pessoa só confirma.
 * Downloads só de endereços fixos, por ação explícita do usuário. Nada roda sem pedido.
 */
export interface LocalAiState {
  whisperBundled: boolean;
  whisperRunning: boolean;
  activeModel?: WhisperModelName;
  installedModels: Array<{ name: WhisperModelName; sizeMb: number }>;
  canInstallOllama: boolean;
}

export type ProgressFn = (task: string, percent: number) => void;

export interface LocalAiDeps {
  userDataDir: string;
  tempDir: string;
  resourcesPath?: string;
  platform: NodeJS.Platform;
  threads: number;
  fetch: typeof fetch;
  /** Abre o instalador do Ollama (a pessoa confirma a instalação). */
  openInstaller: (path: string) => Promise<void>;
  spawnImpl?: typeof spawn;
}

const OLLAMA_SETUP_URL = "https://ollama.com/download/OllamaSetup.exe";
const MODEL_URL = (name: WhisperModelName) => `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${name}.bin`;

export class LocalAiService {
  private child: ChildProcess | undefined;
  private activeModel: WhisperModelName | undefined;
  private busy = new Set<string>();

  constructor(private readonly deps: LocalAiDeps) {}

  private get dir(): string {
    return join(this.deps.userDataDir, "local-ai", "whisper");
  }

  whisperExecutable(): string | undefined {
    return this.whisperExecutables()[0];
  }

  /** Servidor principal (AVX2) e, se existir, a versão compatível com processadores mais antigos. */
  whisperExecutables(): string[] {
    const fromEnv = process.env.OUVE_WHISPER_PATH;
    if (fromEnv && existsSync(fromEnv)) return [fromEnv];
    if (!this.deps.resourcesPath) return [];
    const ext = this.deps.platform === "win32" ? ".exe" : "";
    return ["whisper-server", "whisper-server-compat"]
      .map((n) => join(this.deps.resourcesPath!, "whisper", `${n}${ext}`))
      .filter((exe) => existsSync(exe));
  }

  modelPath(name: WhisperModelName): string {
    return join(this.dir, `ggml-${name}.bin`);
  }

  private async savedModel(): Promise<WhisperModelName | undefined> {
    try {
      const raw = JSON.parse(await readFile(join(this.dir, "state.json"), "utf8")) as { model?: string };
      return WHISPER_MODELS.some((m) => m.name === raw.model) ? (raw.model as WhisperModelName) : undefined;
    } catch {
      return undefined;
    }
  }

  async state(): Promise<LocalAiState> {
    const installed: LocalAiState["installedModels"] = [];
    if (existsSync(this.dir)) {
      const files = await readdir(this.dir);
      for (const m of WHISPER_MODELS) {
        if (files.includes(`ggml-${m.name}.bin`))
          installed.push({ name: m.name, sizeMb: Math.round((await stat(this.modelPath(m.name))).size / 1e6) });
      }
    }
    const active = this.activeModel ?? (await this.savedModel());
    return {
      whisperBundled: !!this.whisperExecutable(),
      whisperRunning: !!this.child && this.child.exitCode === null,
      ...(active ? { activeModel: active } : {}),
      installedModels: installed,
      canInstallOllama: this.deps.platform === "win32"
    };
  }

  private async download(url: string, target: string, task: string, onProgress: ProgressFn, minBytes: number): Promise<void> {
    if (this.busy.has(task)) throw localError("Este download já está em andamento.");
    this.busy.add(task);
    const part = `${target}.part`;
    try {
      const res = await this.deps.fetch(url, { redirect: "follow" });
      if (!res.ok || !res.body) throw localError(`Não foi possível baixar (resposta ${res.status}). Verifique a internet e tente de novo.`);
      const total = Number(res.headers.get("content-length") ?? 0);
      let received = 0;
      let last = -1;
      const source = Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>);
      source.on("data", (chunk: Buffer) => {
        received += chunk.length;
        const pct = total ? Math.floor((received / total) * 100) : 0;
        if (pct !== last) {
          last = pct;
          onProgress(task, pct);
        }
      });
      await pipeline(source, createWriteStream(part));
      if (received < minBytes) throw localError("O arquivo baixado está incompleto. Tente de novo.");
      await rename(part, target);
      onProgress(task, 100);
    } catch (error) {
      await rm(part, { force: true });
      throw error;
    } finally {
      this.busy.delete(task);
    }
  }

  async downloadModel(name: WhisperModelName, onProgress: ProgressFn): Promise<void> {
    const model = WHISPER_MODELS.find((m) => m.name === name);
    if (!model) throw localError("Modelo desconhecido.");
    await mkdir(this.dir, { recursive: true });
    await this.download(MODEL_URL(name), this.modelPath(name), `modelo:${name}`, onProgress, model.sizeMb * 0.9 * 1e6);
  }

  async removeModel(name: WhisperModelName): Promise<void> {
    if (this.activeModel === name) await this.stopWhisper();
    await rm(this.modelPath(name), { force: true });
  }

  /** Liga o servidor de transcrição com o modelo escolhido e espera ele responder. */
  async startWhisper(name: WhisperModelName, language = "pt"): Promise<void> {
    const exes = this.whisperExecutables();
    if (!exes.length) throw localError("A transcrição local não está incluída nesta instalação do Ouve. Atualize o Ouve.");
    if (!existsSync(this.modelPath(name))) throw localError("Baixe o modelo antes de usar.");
    if (this.child && this.child.exitCode === null && this.activeModel === name) return;
    await this.stopWhisper();
    const lang = /^[a-z]{2}$/.test(language) ? language : "auto";
    const args = [
      "-m",
      this.modelPath(name),
      "--host",
      "127.0.0.1",
      "--port",
      String(LOCAL_WHISPER_PORT),
      "--inference-path",
      "/v1/audio/transcriptions",
      "-l",
      lang,
      "-t",
      String(Math.max(1, this.deps.threads))
    ];
    let last: unknown;
    for (const exe of exes) {
      try {
        await this.launch(exe, args, name);
        return;
      } catch (error) {
        last = error;
        // Só tenta a versão compatível quando o processo travou ao abrir (ex.: processador sem AVX2).
        if (!(error instanceof LaunchCrash)) break;
      }
    }
    throw last instanceof LaunchCrash ? localError(last.message) : last;
  }

  private async launch(exe: string, args: string[], name: WhisperModelName): Promise<void> {
    const child = (this.deps.spawnImpl ?? spawn)(exe, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let stderr = "";
    let spawnError: (Error & { code?: string }) | undefined;
    child.stderr?.on("data", (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-4000);
    });
    child.on?.("error", (e: Error) => {
      spawnError = e;
    });
    this.child = child;
    this.activeModel = name;
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, "state.json"), JSON.stringify({ model: name }));
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (spawnError) {
        this.child = undefined;
        throw localError(
          `O Windows ou o antivírus impediu o servidor de transcrição local de abrir (${spawnError.code ?? spawnError.message}). ` +
            "Libere o Ouve no antivírus e tente de novo."
        );
      }
      if (child.exitCode !== null) {
        this.child = undefined;
        throw describeExit(child.exitCode, stderr);
      }
      try {
        const res = await this.deps.fetch(`http://127.0.0.1:${LOCAL_WHISPER_PORT}/`, { signal: AbortSignal.timeout(1000) });
        if (res.status < 500) return;
      } catch {
        /* ainda carregando o modelo */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    await this.stopWhisper();
    throw localError("O servidor de transcrição local demorou demais para iniciar. Tente um modelo menor (base).");
  }

  /** Garante o servidor ligado com o último modelo usado (antes de transcrever). */
  async ensureWhisper(language?: string): Promise<void> {
    if (this.child && this.child.exitCode === null) return;
    const model = this.activeModel ?? (await this.savedModel()) ?? (await this.state()).installedModels[0]?.name;
    if (!model) throw localError("Nenhum modelo de transcrição local foi baixado. Abra Provedores de IA → IA no seu computador.");
    await this.startWhisper(model, language);
  }

  async stopWhisper(): Promise<void> {
    const child = this.child;
    this.child = undefined;
    if (child && child.exitCode === null) child.kill();
  }

  /** Baixa o instalador oficial do Ollama e o abre. A instalação é confirmada pela pessoa. */
  async installOllama(onProgress: ProgressFn): Promise<void> {
    if (this.deps.platform !== "win32")
      throw localError("A instalação pelo Ouve está disponível só no Windows. Use o site oficial do Ollama.");
    const target = join(this.deps.tempDir, "OllamaSetup.exe");
    await this.download(OLLAMA_SETUP_URL, target, "ollama", onProgress, 20e6);
    await this.deps.openInstaller(target);
  }
}

/** Erros da IA local chegam à tela com a mensagem real (não como "Erro inesperado"). */
function localError(message: string): OuveError {
  return new OuveError("provider-unavailable", message, { retryable: false });
}

/** O processo fechou ao abrir de um jeito que vale tentar a versão compatível. */
class LaunchCrash extends Error {}

const ILLEGAL_INSTRUCTION = 0xc000001d;
const DLL_NOT_FOUND = 0xc0000135;

/** Traduz a saída do servidor que fechou ao iniciar em uma mensagem compreensível. */
export function describeExit(code: number, stderr: string): Error {
  const unsigned = code >>> 0;
  const tail = stderr.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0]?.slice(0, 200);
  if (/bind|address already in use|10048/i.test(stderr))
    return localError(
      `A porta ${LOCAL_WHISPER_PORT} já está em uso por outro programa (talvez outro Whisper aberto). Feche-o ou reinicie o computador e tente de novo.`
    );
  if (/failed to (load|read|initialize).*model|invalid model|bad magic/i.test(stderr))
    return localError("O arquivo do modelo parece corrompido. Clique em “remover” e baixe o modelo de novo.");
  if (unsigned === ILLEGAL_INSTRUCTION)
    return new LaunchCrash("O processador deste computador não é compatível com a transcrição local (falta a instrução AVX2).");
  if (unsigned === DLL_NOT_FOUND) return new LaunchCrash("Falta um componente do Windows para a transcrição local (DLL não encontrada).");
  if (unsigned >= 0xc0000000)
    return new LaunchCrash(
      `O servidor de transcrição local travou ao abrir (código 0x${unsigned.toString(16)}).${tail ? ` Detalhe: ${tail}` : ""}`
    );
  return localError(`O servidor de transcrição local fechou ao iniciar (código ${code}).${tail ? ` Detalhe: ${tail}` : ""}`);
}
