import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { validateMediaFile, type MediaLimits } from "@ouve/core";
import { OuveError, createLogger } from "@ouve/shared";
import type { ExtractedSegment, ImportedMedia } from "../shared/ipc.js";

const log = createLogger("media");

/**
 * Localiza o ffmpeg: variável OUVE_FFMPEG_PATH, binário do pacote ffmpeg-static
 * (fora do asar quando empacotado) ou `ffmpeg` no PATH.
 * ATENÇÃO: o binário do ffmpeg-static tem licença GPL; ver docs/05 (P-029).
 */
export function locateFfmpeg(): string {
  const fromEnv = process.env.OUVE_FFMPEG_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  // Aplicativo instalado: o binário vai em resources/ (extraResources do electron-builder).
  const resources = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (resources) {
    const bundled = join(resources, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
    if (existsSync(bundled)) return bundled;
  }
  try {
    const require = createRequire(import.meta.url);
    const staticPath = (require("ffmpeg-static") as string | null)?.replace("app.asar", "app.asar.unpacked");
    if (staticPath && existsSync(staticPath)) return staticPath;
  } catch {
    /* pacote ausente */
  }
  return "ffmpeg";
}

interface RunResult {
  code: number | null;
  stderr: string;
}

function run(
  ffmpeg: string,
  args: string[],
  options: { signal?: AbortSignal; onStdout?: (chunk: string) => void } = {}
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (d: string) => options.onStdout?.(d));
    child.stderr.setEncoding("utf8").on("data", (d: string) => {
      // Mantém só o final: suficiente para diagnosticar sem acumular memória.
      stderr = (stderr + d).slice(-8000);
    });
    const onAbort = () => child.kill("SIGKILL");
    options.signal?.addEventListener("abort", onAbort, { once: true });
    child.on("error", (error) => {
      options.signal?.removeEventListener("abort", onAbort);
      reject(
        new OuveError("unsupported", "ffmpeg não encontrado. Instale o ffmpeg ou defina OUVE_FFMPEG_PATH.", {
          cause: error,
          retryable: false
        })
      );
    });
    child.on("close", (code) => {
      options.signal?.removeEventListener("abort", onAbort);
      if (options.signal?.aborted) reject(new OuveError("cancelled", "Extração cancelada."));
      else resolve({ code, stderr });
    });
  });
}

export function parseDurationMs(stderr: string): number | undefined {
  const match = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
  if (!match) return undefined;
  return Math.round((Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000);
}

export async function probeMedia(ffmpeg: string, path: string): Promise<{ durationMs?: number; hasAudio: boolean }> {
  const { stderr } = await run(ffmpeg, ["-hide_banner", "-nostdin", "-i", path]);
  const durationMs = parseDurationMs(stderr);
  const hasAudio = /Stream #\d+:\d+.*Audio:/.test(stderr);
  return durationMs === undefined ? { hasAudio } : { durationMs, hasAudio };
}

/** Lê a lista CSV do ffmpeg ("seg00000.mp3,0.000000,600.000000") com o início e o fim exatos de cada pedaço. */
export function parseSegmentList(csv: string, format: "wav" | "mp3"): ExtractedSegment[] {
  return csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [, start = "0", end = "0"] = line.split(",");
      const startMs = Math.round(Number(start) * 1000);
      return {
        index,
        offsetMs: startMs,
        durationMs: Math.max(0, Math.round(Number(end) * 1000) - startMs),
        mimeType: format === "mp3" ? "audio/mpeg" : "audio/wav"
      };
    });
}

interface MediaEntry {
  path: string;
  name: string;
  dir?: string;
  format?: "wav" | "mp3";
  segments: ExtractedSegment[];
}

/**
 * Importação: valida o arquivo, extrai SOMENTE a faixa de áudio (vídeo é
 * ignorado com -vn) em segmentos WAV 16 kHz mono num diretório temporário,
 * processado em fluxo pelo ffmpeg. Nada é carregado inteiro na memória.
 */
export class MediaService {
  private readonly entries = new Map<string, MediaEntry>();
  private readonly controllers = new Map<string, AbortController>();

  constructor(private readonly ffmpeg: string = locateFfmpeg()) {}

  async register(path: string, limits: MediaLimits): Promise<ImportedMedia> {
    const info = await stat(path);
    const name = basename(path);
    const pre = validateMediaFile({ name, sizeBytes: info.size }, limits);
    if (!pre.ok) throw new OuveError(pre.code === "file-too-large" ? "file-too-large" : "invalid-input", pre.message, { retryable: false });
    const probe = await probeMedia(this.ffmpeg, path);
    if (!probe.hasAudio) throw new OuveError("no-audio", "O arquivo não possui faixa de áudio.", { retryable: false });
    const full = validateMediaFile(
      { name, sizeBytes: info.size, ...(probe.durationMs !== undefined ? { durationMs: probe.durationMs } : {}) },
      limits
    );
    if (!full.ok) throw new OuveError("duration-exceeded", full.message, { retryable: false });
    const token = randomUUID();
    this.entries.set(token, { path, name, segments: [] });
    return {
      token,
      name,
      sizeBytes: info.size,
      kind: pre.kind,
      ...(probe.durationMs !== undefined ? { durationMs: probe.durationMs } : {})
    };
  }

  async extract(
    token: string,
    segmentSeconds: number,
    onProgress?: (processedMs: number) => void,
    format: "wav" | "mp3" = "wav"
  ): Promise<ExtractedSegment[]> {
    const entry = this.entry(token);
    if (entry.dir) return entry.segments;
    const dir = await mkdtemp(join(tmpdir(), "ouve-"));
    entry.dir = dir;
    entry.format = format;
    const controller = new AbortController();
    this.controllers.set(token, controller);
    // MP3 32 kbps mono: ~2,4 MB a cada 10 min, abaixo dos limites por pedido dos provedores.
    const codec = format === "mp3" ? ["-c:a", "libmp3lame", "-b:a", "32k"] : ["-c:a", "pcm_s16le"];
    const args = [
      "-hide_banner",
      "-nostdin",
      "-loglevel",
      "error",
      "-progress",
      "pipe:1",
      "-i",
      entry.path,
      "-map",
      "0:a:0",
      "-vn",
      "-sn",
      "-dn",
      "-ac",
      "1",
      "-ar",
      "16000",
      ...codec,
      "-f",
      "segment",
      "-segment_time",
      String(segmentSeconds),
      "-segment_list",
      join(dir, "lista.csv"),
      "-segment_list_type",
      "csv",
      "-reset_timestamps",
      "1",
      join(dir, `seg%05d.${format}`)
    ];
    const result = await run(this.ffmpeg, args, {
      signal: controller.signal,
      onStdout: (chunk) => {
        const match = /out_time_ms=(\d+)/g.exec(chunk);
        if (match && onProgress) onProgress(Math.round(Number(match[1]) / 1000));
      }
    }).finally(() => this.controllers.delete(token));
    if (result.code !== 0) {
      log.warn("Falha na extração de áudio.", { exitCode: result.code ?? -1 });
      throw new OuveError("invalid-input", "Não foi possível extrair o áudio do arquivo (formato ou codec não suportado).", {
        retryable: false
      });
    }
    entry.segments = parseSegmentList(await readFile(join(dir, "lista.csv"), "utf8"), format);
    return entry.segments;
  }

  async readSegment(token: string, index: number): Promise<Uint8Array> {
    const entry = this.entry(token);
    if (!entry.dir || !entry.segments[index]) throw new OuveError("invalid-input", "Segmento inexistente.", { retryable: false });
    return new Uint8Array(await readFile(join(entry.dir, `seg${String(index).padStart(5, "0")}.${entry.format ?? "wav"}`)));
  }

  /** Cancela extração e apaga arquivos temporários. */
  async release(token: string): Promise<void> {
    this.controllers.get(token)?.abort();
    const entry = this.entries.get(token);
    this.entries.delete(token);
    if (entry?.dir) await rm(entry.dir, { recursive: true, force: true });
  }

  async releaseAll(): Promise<void> {
    await Promise.all([...this.entries.keys()].map((t) => this.release(t)));
  }

  private entry(token: string): MediaEntry {
    const entry = this.entries.get(token);
    if (!entry) throw new OuveError("invalid-input", "Arquivo não encontrado na sessão atual.", { retryable: false });
    return entry;
  }
}
