import type { AiTask, ProviderConfig, ProviderProtocol } from "@ouve/core";
import { OuveError } from "@ouve/shared";
import { presetFor } from "./catalog.js";
import { createProviderBundle } from "./factory.js";
import type { FetchLike } from "./http.js";

/**
 * Configuração rápida (D-065): o usuário só cola a chave. O Ouve reconhece o
 * provedor pelo formato, testa a conexão, escolhe os modelos entre os
 * disponíveis para aquela chave e habilita os serviços que o provedor oferece.
 */

/** Reconhece o provedor pelo prefixo da chave. A ordem importa: "sk-ant-" antes de "sk-". */
export function detectProtocolFromKey(apiKey: string): ProviderProtocol | undefined {
  const key = apiKey.trim();
  if (/^sk-ant-/.test(key)) return "anthropic";
  if (/^xai-/.test(key)) return "xai";
  // Google: chaves antigas "AIza…" e chaves de autenticação "AQ.…" (padrão do AI Studio desde 28/05/2026).
  if (/^AIza[0-9A-Za-z_-]{20,}$/.test(key) || /^AQ\.[0-9A-Za-z._-]{20,}$/.test(key)) return "gemini";
  if (/^sk-[A-Za-z0-9_-]{16,}/.test(key)) return "openai";
  return undefined;
}

const TASKS: Partial<Record<ProviderProtocol, AiTask[]>> = {
  openai: ["transcription", "analysis", "report"],
  gemini: ["transcription", "analysis", "report"],
  anthropic: ["analysis", "report"],
  xai: ["analysis", "report"]
};

/** Extrai a versão numérica de um id de modelo ("gemini-3.5-flash" → [3,5]; "claude-sonnet-4-5" → [4,5]). */
function versionOf(id: string): number[] {
  const match = /(\d+(?:[.-]\d+)*)/.exec(id.replace(/-\d{8}$/, ""));
  return match ? (match[1] ?? "").split(/[.-]/).map(Number) : [];
}

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Escolhe o modelo de versão mais alta que casa com a regra, ignorando variantes indesejadas. */
export function pickNewest(models: string[], include: RegExp, exclude?: RegExp): string | undefined {
  return models
    .filter((m) => include.test(m) && !(exclude?.test(m) ?? false))
    .sort((a, b) => compareVersions(versionOf(b), versionOf(a)) || a.length - b.length)[0];
}

/** Escolhe modelos de análise e transcrição entre os disponíveis; sem lista, usa as sugestões do catálogo. */
export function pickModels(protocol: ProviderProtocol, models: string[]): { model: string; transcriptionModel?: string } {
  const preset = presetFor(protocol);
  const fallback = {
    model: preset.suggestedModel,
    ...(preset.suggestedTranscriptionModel ? { transcriptionModel: preset.suggestedTranscriptionModel } : {})
  };
  if (models.length === 0) return fallback;
  const avoid = /(live|preview|exp|image|vision|tts|audio|realtime|search|embed|lite|nano)/i;
  switch (protocol) {
    case "openai": {
      const transcription =
        ["gpt-4o-transcribe-diarize", "whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe"].find((m) => models.includes(m)) ??
        fallback.transcriptionModel;
      const model = pickNewest(models, /^gpt-[\d.]+o?-mini$/) ?? pickNewest(models, /^gpt-[\d.]+o?$/) ?? fallback.model;
      return { model, ...(transcription ? { transcriptionModel: transcription } : {}) };
    }
    case "gemini": {
      const model = pickNewest(models, /^gemini-[\d.]+-flash$/, avoid) ?? pickNewest(models, /^gemini-.*flash/, avoid) ?? fallback.model;
      const transcription = pickNewest(models, /^gemini-[\d.]+-transcribe$/) ?? pickNewest(models, /transcribe/, /live/) ?? model;
      return { model, transcriptionModel: transcription };
    }
    case "anthropic":
      return { model: pickNewest(models, /sonnet/) ?? fallback.model };
    case "xai":
      return { model: pickNewest(models, /^grok-[\d.]+/, /(image|vision|imagine|code)/i) ?? fallback.model };
    default:
      return fallback;
  }
}

export interface QuickSetupResult {
  ok: boolean;
  message: string;
  protocol?: ProviderProtocol;
  config?: ProviderConfig;
  canTranscribe: boolean;
  canAnalyze: boolean;
  /** Avisos para o usuário (ex.: provedor não transcreve, plano gratuito). */
  notes: string[];
}

export const GEMINI_FREE_TIER_NOTE =
  "Se a sua chave do Gemini for do plano gratuito, o Google pode usar o áudio e o texto enviados para melhorar os produtos dele. Para audiências ou conteúdo sigiloso, ative a cobrança no Google AI Studio (custa centavos por hora de áudio).";

export async function runQuickSetup(apiKey: string, fetchImpl: FetchLike, id: string): Promise<QuickSetupResult> {
  const key = apiKey.trim();
  const protocol = detectProtocolFromKey(key);
  if (!protocol) {
    throw new OuveError(
      "invalid-input",
      "Não reconheci essa chave. A configuração rápida aceita chaves da OpenAI (sk-…), Google Gemini (AIza… ou AQ.…), Anthropic Claude (sk-ant-…) e xAI Grok (xai-…). Para outros provedores, use a configuração avançada.",
      { retryable: false }
    );
  }
  const preset = presetFor(protocol);
  const tasks = TASKS[protocol] ?? ["analysis", "report"];
  const base: ProviderConfig = {
    id,
    displayName: preset.displayName,
    protocol,
    model: preset.suggestedModel || "auto",
    enabledTasks: tasks
  };
  if (preset.suggestedTranscriptionModel) base.transcriptionModel = preset.suggestedTranscriptionModel;

  const test = await createProviderBundle(base, { apiKey: key }, fetchImpl).testConnection();
  if (!test.ok) return { ok: false, message: test.message, protocol, canTranscribe: false, canAnalyze: false, notes: [] };

  const picked = pickModels(protocol, test.models ?? []);
  const config: ProviderConfig = { ...base, model: picked.model };
  if (tasks.includes("transcription") && picked.transcriptionModel) config.transcriptionModel = picked.transcriptionModel;
  else delete config.transcriptionModel;

  const canTranscribe = tasks.includes("transcription");
  const notes: string[] = [];
  if (!canTranscribe)
    notes.push(
      `${preset.displayName} não transcreve áudio. Ele fará a análise; para a transcrição, cole também uma chave da OpenAI ou do Google Gemini.`
    );
  if (protocol === "gemini") notes.push(GEMINI_FREE_TIER_NOTE);

  return {
    ok: true,
    message: `${preset.displayName} conectado. ${canTranscribe ? "Transcrição e análise configuradas." : "Análise configurada."}`,
    protocol,
    config,
    canTranscribe,
    canAnalyze: true,
    notes
  };
}
