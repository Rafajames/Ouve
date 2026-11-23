import { decodeFile, type DecodedFile } from "@ouve/capture";
import {
  createProviderBundle,
  credentialRefFor,
  presetFor,
  runQuickSetup,
  validateProviderConfig,
  SwitchableSecretStore,
  probeLocalServers,
  reconcileProviderSelection,
  type AsyncKeyValue
} from "@ouve/providers";
import { OuveError, createId, toOuveError } from "@ouve/shared";
import type { AppSettings, ExtractedSegment, IpcResult, OuveBridge, ProviderSummary } from "../../desktop/src/shared/ipc";
import { DEFAULT_SETTINGS } from "../../desktop/src/shared/ipc";
import type { ProviderConfig } from "@ouve/core";

/**
 * Ponte da versão web (D-069): implementa a mesma interface do desktop no
 * navegador, para reaproveitar todas as telas. Sem servidor do Ouve: as
 * chamadas de IA saem direto do navegador para o provedor configurado.
 * Preferências ficam no localStorage. Chaves ficam por padrão só na sessão
 * (sessionStorage, somem ao fechar a aba); lembrar no navegador é escolha do
 * usuário, com aviso de que não há criptografia do sistema operacional.
 */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const ok = <T>(value: T): IpcResult<T> => ({ ok: true, value });
const fail = (error: unknown): IpcResult<never> => {
  const e = toOuveError(error);
  return { ok: false, error: { code: e.code, message: e.message, retryable: e.retryable } };
};
async function wrap<T>(run: () => Promise<T> | T): Promise<IpcResult<T>> {
  try {
    return ok(await run());
  } catch (error) {
    return fail(error);
  }
}

export interface WebBridgeDeps {
  storage: KeyValueStore;
  /** Armazenamento da sessão (sessionStorage). Ausente = memória. */
  sessionStorage?: KeyValueStore;
  fetch: typeof fetch;
  /** Abre o seletor de arquivos; resolve null se o usuário cancelar. */
  pickFile: () => Promise<File | null>;
  /** Oferece o download de um arquivo gerado localmente. */
  download: (fileName: string, bytes: Uint8Array) => void;
  decode?: (file: File, chunkSeconds: number) => Promise<DecodedFile>;
  setTitle?: (title: string) => void;
}

export function createWebBridge(deps: WebBridgeDeps): OuveBridge {
  const { storage } = deps;
  const read = <T>(key: string, fallback: T): T => {
    try {
      const raw = storage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key: string, value: unknown) => storage.setItem(key, JSON.stringify(value));

  const kv = (area: KeyValueStore): AsyncKeyValue => ({
    get: async (ref) => area.getItem(`ouve.secret.${ref}`) ?? undefined,
    set: async (ref, value) => area.setItem(`ouve.secret.${ref}`, value),
    delete: async (ref) => area.removeItem(`ouve.secret.${ref}`)
  });
  const memory = new Map<string, string>();
  const sessionArea: KeyValueStore = deps.sessionStorage ?? {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
    removeItem: (k) => void memory.delete(k)
  };
  // Quem já tinha chaves salvas antes desta versão continua com "lembrar" ligado (sem surpresa).
  const legacy = read<ProviderConfig[]>("ouve.providers", []).some((p) => storage.getItem(`ouve.secret.${credentialRefFor(p.id)}`));
  const rememberFlag = storage.getItem("ouve.rememberKeys");
  const secrets = new SwitchableSecretStore(kv(sessionArea), kv(storage), rememberFlag ? rememberFlag === "1" : legacy, (remember) =>
    storage.setItem("ouve.rememberKeys", remember ? "1" : "0")
  );

  const getSettings = (): AppSettings =>
    reconcileProviderSelection({ ...DEFAULT_SETTINGS, ...read<Partial<AppSettings>>("ouve.settings", {}) }, listConfigs());
  const listConfigs = (): ProviderConfig[] => read<ProviderConfig[]>("ouve.providers", []);
  const summaries = async (): Promise<ProviderSummary[]> =>
    Promise.all(listConfigs().map(async (config) => ({ config, hasKey: !!(await secrets.get(credentialRefFor(config.id))) })));

  const saveProvider = async (config: ProviderConfig, apiKey?: string): Promise<ProviderSummary> => {
    const errors = validateProviderConfig(config);
    if (errors.length) throw new OuveError("invalid-input", errors.join(" "), { retryable: false });
    const ref = credentialRefFor(config.id);
    const clean = { ...config, credentialRef: ref };
    if (apiKey !== undefined) {
      if (apiKey.trim()) await secrets.set(ref, apiKey.trim());
      else await secrets.delete(ref);
    }
    write("ouve.providers", [...listConfigs().filter((p) => p.id !== config.id), clean]);
    return { config: clean, hasKey: !!(await secrets.get(ref)) };
  };

  const removeProvider = async (id: string) => {
    await secrets.delete(credentialRefFor(id));
    write(
      "ouve.providers",
      listConfigs().filter((p) => p.id !== id)
    );
  };

  const bundle = async (id: string) => {
    const config = listConfigs().find((p) => p.id === id);
    if (!config) throw new OuveError("invalid-input", "Provedor não configurado.", { retryable: false });
    const key = await secrets.get(credentialRefFor(id));
    return createProviderBundle(config, key ? { apiKey: key } : undefined, (input, init) => deps.fetch(input, init));
  };

  const inflight = new Map<string, AbortController>();
  const track = async <T>(requestId: string, run: (signal: AbortSignal) => Promise<T>) => {
    const controller = new AbortController();
    inflight.set(requestId, controller);
    try {
      return await run(controller.signal);
    } finally {
      inflight.delete(requestId);
    }
  };

  const media = new Map<string, { file: File; decoded?: DecodedFile; segmentSeconds?: number }>();
  const decode = deps.decode ?? ((file: File, chunk: number) => decodeFile(file, chunk));

  return {
    platform: "web",
    version: "0.2.0",
    e2e: false,
    capture: {
      // No navegador o seletor é o do próprio Chrome/Edge (getDisplayMedia); não há lista prévia.
      listSources: async () => ok([]),
      selectSource: async () => ok(undefined),
      setActive: async (active) => {
        deps.setTitle?.(active ? "● Capturando áudio — Ouve" : "Ouve");
        return ok(undefined);
      }
    },
    settings: {
      get: async () => ok(getSettings()),
      save: async (settings) =>
        wrap(() => {
          const merged = { ...DEFAULT_SETTINGS, ...settings };
          write("ouve.settings", merged);
          return merged;
        })
    },
    providers: {
      list: () => wrap(summaries),
      save: (input) => wrap(() => saveProvider(input.config, input.apiKey)),
      remove: (id) => wrap(() => removeProvider(id)),
      test: (id) => wrap(async () => (await bundle(id)).testConnection()),
      protection: async () => ok({ protection: secrets.protection }),
      setKeyPersistence: (remember) =>
        wrap(async () => {
          await secrets.setRemember(
            remember,
            listConfigs().map((c) => credentialRefFor(c.id))
          );
          return { protection: secrets.protection };
        }),
      quickSetup: (apiKey) =>
        wrap(async () => {
          const id = `rapido-${Date.now().toString(36)}`;
          const result = await runQuickSetup(apiKey, (input, init) => deps.fetch(input, init), id);
          if (!result.ok || !result.config || !result.protocol) {
            return { ok: false, message: result.message, notes: result.notes, canTranscribe: false, canAnalyze: false };
          }
          for (const old of listConfigs())
            if (old.protocol === result.protocol && old.id.startsWith("rapido-")) await removeProvider(old.id);
          await saveProvider(result.config, apiKey);
          const settings = getSettings();
          if (result.canTranscribe) settings.transcriptionProviderId = id;
          if (result.canAnalyze) settings.analysisProviderId = id;
          write("ouve.settings", settings);
          return {
            ok: true,
            message: result.message,
            notes: result.notes,
            providerName: presetFor(result.protocol).displayName,
            canTranscribe: result.canTranscribe,
            canAnalyze: result.canAnalyze
          };
        })
    },
    ai: {
      transcribe: (input) =>
        wrap(async () => {
          const b = await bundle(input.providerId);
          if (!b.transcription)
            throw new OuveError("unsupported", "Este provedor não está habilitado para transcrição.", { retryable: false });
          const transcription = b.transcription;
          return track(input.requestId, (signal) =>
            transcription.transcribe(
              {
                audio: new Blob([input.audio], { type: input.mimeType }),
                mimeType: input.mimeType,
                durationMs: input.durationMs,
                ...(input.language ? { language: input.language } : {}),
                ...(input.previousText ? { previousText: input.previousText } : {})
              },
              signal
            )
          );
        }),
      complete: (input) =>
        wrap(async () => {
          const b = await bundle(input.providerId);
          if (!b.completion) throw new OuveError("unsupported", "Este provedor não está habilitado para análise.", { retryable: false });
          const completion = b.completion;
          return track(input.requestId, (signal) => completion.complete(input.request, signal));
        }),
      cancel: async (requestId) => {
        inflight.get(requestId)?.abort();
        return ok(undefined);
      }
    },
    media: {
      open: () =>
        wrap(async () => {
          const file = await deps.pickFile();
          if (!file) return null;
          const token = createId("arq");
          media.set(token, { file });
          const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
          const kind = ["mp4", "mov", "mkv", "webm"].includes(ext) ? ("video" as const) : ("audio" as const);
          return { token, name: file.name, sizeBytes: file.size, kind };
        }),
      // No navegador não há ffmpeg: o áudio é decodificado localmente e dividido em WAV de até 5 min.
      extract: (token, segmentSeconds) =>
        wrap(async (): Promise<ExtractedSegment[]> => {
          const entry = media.get(token);
          if (!entry) throw new OuveError("invalid-input", "Arquivo não encontrado na sessão atual.", { retryable: false });
          const chunk = Math.min(300, Math.max(30, segmentSeconds));
          entry.decoded = await decode(entry.file, chunk);
          entry.segmentSeconds = chunk;
          return Array.from({ length: entry.decoded.count }, (_, index) => {
            const c = entry.decoded!.chunk(index);
            return { index, offsetMs: c.offsetMs, durationMs: c.durationMs, mimeType: "audio/wav" as const };
          });
        }),
      readSegment: (token, index) =>
        wrap(async () => {
          const entry = media.get(token);
          if (!entry?.decoded) throw new OuveError("invalid-input", "Segmento inexistente.", { retryable: false });
          const wav = entry.decoded.chunk(index).wav;
          return wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer;
        }),
      release: async (token) => {
        media.delete(token);
        return ok(undefined);
      },
      onProgress: () => () => undefined
    },
    local: {
      probe: () =>
        wrap(async () => {
          const nav = (globalThis as { navigator?: { deviceMemory?: number; hardwareConcurrency?: number } }).navigator;
          return {
            results: await probeLocalServers((input, init) => deps.fetch(input, init)),
            // deviceMemory é limitado pelo navegador (no máx. 8): serve só de indicação.
            hardware: {
              ...(nav?.deviceMemory ? { ramGb: nav.deviceMemory } : {}),
              ...(nav?.hardwareConcurrency ? { cores: nav.hardwareConcurrency } : {})
            }
          };
        })
    },
    files: {
      save: (fileName, bytes) =>
        wrap(() => {
          deps.download(fileName, bytes);
          return fileName;
        })
    }
  };
}
