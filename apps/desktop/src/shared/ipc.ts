/**
 * Contrato IPC entre renderer e processo principal. Canais em allowlist;
 * o renderer nunca recebe chaves de API nem caminhos de arquivos temporários.
 */
import type { AiTask, CompletionRequest, ConnectionTestResult, ProviderConfig, ProviderProtocol, ProviderSegment } from "@ouve/core";

export interface DesktopSource {
  id: string;
  name: string;
  kind: "screen" | "window";
}

export interface AppSettings {
  language: string;
  transcriptionProviderId?: string;
  analysisProviderId?: string;
  /** Duração dos blocos de áudio ao vivo (s). */
  liveChunkSeconds: number;
  /** Duração dos segmentos ao importar arquivos (s). */
  importSegmentSeconds: number;
  maxFileGb: number;
  maxHours: number;
  includeTranscriptInExport: boolean;
  theme: "system" | "light" | "dark";
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "pt-BR",
  liveChunkSeconds: 20,
  importSegmentSeconds: 120,
  maxFileGb: 2,
  maxHours: 4,
  includeTranscriptInExport: true,
  theme: "system"
};

export interface ProviderSummary {
  config: ProviderConfig;
  hasKey: boolean;
}

export interface SaveProviderInput {
  config: ProviderConfig;
  /** Nova chave (opcional). String vazia remove a chave. Undefined mantém a atual. */
  apiKey?: string;
}

export interface SecretProtection {
  protection: "os-encrypted" | "browser-profile" | "memory-only";
}

export interface ImportedMedia {
  token: string;
  name: string;
  sizeBytes: number;
  kind: "audio" | "video";
  durationMs?: number;
}

export interface ExtractedSegment {
  index: number;
  offsetMs: number;
  durationMs: number;
}

export interface TranscribeInput {
  requestId: string;
  providerId: string;
  audio: ArrayBuffer;
  mimeType: string;
  durationMs: number;
  language?: string;
  previousText?: string;
}

export interface CompleteInput {
  requestId: string;
  providerId: string;
  request: CompletionRequest;
}

/** Erro serializável (OuveError não atravessa o IPC com a classe). */
export interface IpcError {
  code: string;
  message: string;
  retryable: boolean;
}

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: IpcError };

export interface OuveBridge {
  platform: string;
  version: string;
  e2e: boolean;
  capture: {
    listSources(): Promise<IpcResult<DesktopSource[]>>;
    selectSource(id: string): Promise<IpcResult<void>>;
    setActive(active: boolean): Promise<IpcResult<void>>;
  };
  settings: {
    get(): Promise<IpcResult<AppSettings>>;
    save(settings: AppSettings): Promise<IpcResult<AppSettings>>;
  };
  providers: {
    list(): Promise<IpcResult<ProviderSummary[]>>;
    save(input: SaveProviderInput): Promise<IpcResult<ProviderSummary>>;
    remove(id: string): Promise<IpcResult<void>>;
    test(id: string): Promise<IpcResult<ConnectionTestResult>>;
    protection(): Promise<IpcResult<SecretProtection>>;
  };
  ai: {
    transcribe(input: TranscribeInput): Promise<IpcResult<{ segments: ProviderSegment[]; detectedLanguage?: string }>>;
    complete(input: CompleteInput): Promise<IpcResult<string>>;
    cancel(requestId: string): Promise<IpcResult<void>>;
  };
  media: {
    open(): Promise<IpcResult<ImportedMedia | null>>;
    extract(token: string, segmentSeconds: number): Promise<IpcResult<ExtractedSegment[]>>;
    readSegment(token: string, index: number): Promise<IpcResult<ArrayBuffer>>;
    release(token: string): Promise<IpcResult<void>>;
    onProgress(listener: (token: string, processedMs: number) => void): () => void;
  };
  files: {
    save(fileName: string, bytes: Uint8Array): Promise<IpcResult<string | null>>;
  };
}

export const IPC = {
  listSources: "capture:list-sources",
  selectSource: "capture:select-source",
  setCaptureActive: "capture:set-active",
  getSettings: "settings:get",
  saveSettings: "settings:save",
  listProviders: "providers:list",
  saveProvider: "providers:save",
  removeProvider: "providers:remove",
  testProvider: "providers:test",
  secretProtection: "providers:protection",
  transcribe: "ai:transcribe",
  complete: "ai:complete",
  cancel: "ai:cancel",
  openMedia: "media:open",
  extractMedia: "media:extract",
  readSegment: "media:read-segment",
  releaseMedia: "media:release",
  mediaProgress: "media:progress",
  saveFile: "files:save"
} as const;

export const ALL_TASKS: AiTask[] = ["transcription", "diarization", "analysis", "report"];
export type { ProviderProtocol };
