import type { AiTask, ProviderConfig, ProviderProtocol } from "@ouve/core";
import { OuveError, sanitizeLabel } from "@ouve/shared";
import { DEFAULT_SETTINGS, type AppSettings } from "../shared/ipc.js";

/** Validação de payloads IPC: o renderer é tratado como não confiável. */

const PROTOCOLS: ProviderProtocol[] = ["openai", "openai-compatible", "gemini", "anthropic", "xai", "custom"];
const TASKS: AiTask[] = ["transcription", "diarization", "analysis", "report"];

export function assertString(value: unknown, name: string, max = 2000): string {
  if (typeof value !== "string" || value.length > max)
    throw new OuveError("invalid-input", `Campo inválido: ${name}.`, { retryable: false });
  return value;
}

export function assertNumber(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new OuveError("invalid-input", `Campo inválido: ${name}.`, { retryable: false });
  }
  return value;
}

export function parseProviderConfig(raw: unknown): ProviderConfig {
  if (typeof raw !== "object" || raw === null) throw new OuveError("invalid-input", "Configuração inválida.", { retryable: false });
  const r = raw as Record<string, unknown>;
  const protocol = r.protocol as ProviderProtocol;
  if (!PROTOCOLS.includes(protocol)) throw new OuveError("invalid-input", "Tipo de provedor inválido.", { retryable: false });
  const id = assertString(r.id, "id", 80);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new OuveError("invalid-input", "Identificador inválido.", { retryable: false });
  const tasks = Array.isArray(r.enabledTasks) ? r.enabledTasks.filter((t): t is AiTask => TASKS.includes(t as AiTask)) : [];
  const config: ProviderConfig = {
    id,
    displayName: sanitizeLabel(assertString(r.displayName, "nome", 200)),
    model: sanitizeLabel(assertString(r.model, "modelo", 200), 200),
    protocol,
    enabledTasks: [...new Set(tasks)]
  };
  if (typeof r.baseUrl === "string" && r.baseUrl.trim()) config.baseUrl = assertString(r.baseUrl, "endpoint", 500).trim();
  if (typeof r.transcriptionModel === "string" && r.transcriptionModel.trim())
    config.transcriptionModel = sanitizeLabel(r.transcriptionModel, 200);
  if (r.timeoutMs !== undefined) config.timeoutMs = assertNumber(r.timeoutMs, "timeout", 5_000, 600_000);
  if (r.maxRetries !== undefined) config.maxRetries = assertNumber(r.maxRetries, "tentativas", 0, 5);
  if (r.extraHeaders && typeof r.extraHeaders === "object") {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.extraHeaders as Record<string, unknown>).slice(0, 10)) {
      if (/^[A-Za-z0-9-]{1,64}$/.test(k) && typeof v === "string") headers[k] = v.slice(0, 500);
    }
    if (Object.keys(headers).length) config.extraHeaders = headers;
  }
  return config;
}

export function parseSettings(raw: unknown): AppSettings {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const num = (key: keyof AppSettings, min: number, max: number) => {
    const v = r[key];
    return typeof v === "number" && v >= min && v <= max ? v : (DEFAULT_SETTINGS[key] as number);
  };
  const settings: AppSettings = {
    language: typeof r.language === "string" && /^[A-Za-z-]{2,10}$/.test(r.language) ? r.language : DEFAULT_SETTINGS.language,
    liveChunkSeconds: num("liveChunkSeconds", 5, 120),
    importSegmentSeconds: num("importSegmentSeconds", 30, 600),
    importAuto: typeof r.importAuto === "boolean" ? r.importAuto : true,
    maxFileGb: num("maxFileGb", 0.1, 8),
    maxHours: num("maxHours", 0.25, 12),
    includeTranscriptInExport: typeof r.includeTranscriptInExport === "boolean" ? r.includeTranscriptInExport : true,
    theme: r.theme === "light" || r.theme === "dark" ? r.theme : "system"
  };
  if (
    typeof r.termsAcceptedVersion === "number" &&
    Number.isInteger(r.termsAcceptedVersion) &&
    r.termsAcceptedVersion > 0 &&
    r.termsAcceptedVersion < 1000
  )
    settings.termsAcceptedVersion = r.termsAcceptedVersion;
  if (typeof r.transcriptionProviderId === "string" && r.transcriptionProviderId)
    settings.transcriptionProviderId = r.transcriptionProviderId.slice(0, 80);
  if (typeof r.analysisProviderId === "string" && r.analysisProviderId) settings.analysisProviderId = r.analysisProviderId.slice(0, 80);
  return settings;
}
