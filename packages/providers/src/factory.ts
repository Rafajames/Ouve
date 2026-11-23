import type { CompletionProvider, ConnectionTestResult, ProviderConfig, ProviderCredentials, TranscriptionProvider } from "@ouve/core";
import { OuveError, toOuveError, validateEndpointUrl } from "@ouve/shared";
import { AnthropicCompletion, testAnthropicConnection, type AnthropicOptions } from "./anthropic.js";
import { presetFor } from "./catalog.js";
import { GeminiCompletion, GeminiTranscription, testGeminiConnection, type GeminiOptions } from "./gemini.js";
import type { FetchLike } from "./http.js";
import { OpenAiCompletion, OpenAiTranscription, testOpenAiConnection, type OpenAiStyleOptions } from "./openai.js";

export interface ProviderBundle {
  config: ProviderConfig;
  transcription?: TranscriptionProvider;
  completion?: CompletionProvider;
  testConnection(signal?: AbortSignal): Promise<ConnectionTestResult>;
}

const FORBIDDEN_HEADERS = /^(authorization|x-api-key|x-goog-api-key|cookie|host|content-length)$/i;

/** Valida configuração não secreta antes de salvar ou usar. */
export function validateProviderConfig(config: ProviderConfig): string[] {
  const errors: string[] = [];
  const preset = presetFor(config.protocol);
  if (!config.displayName.trim()) errors.push("Informe um nome para o provedor.");
  if (!config.model.trim()) errors.push("Informe o modelo.");
  if (config.enabledTasks.length === 0) errors.push("Habilite ao menos um serviço.");
  for (const task of config.enabledTasks) {
    if (!preset.tasks.includes(task)) errors.push(`${preset.displayName} não oferece o serviço "${task}" neste adaptador.`);
  }
  const baseUrl = config.baseUrl?.trim() || preset.defaultBaseUrl;
  if (!baseUrl) errors.push("Informe o endpoint (URL base).");
  else {
    try {
      validateEndpointUrl(baseUrl);
    } catch (error) {
      errors.push((error as Error).message);
    }
  }
  for (const name of Object.keys(config.extraHeaders ?? {})) {
    if (FORBIDDEN_HEADERS.test(name)) errors.push(`Cabeçalho não permitido: ${name}. Use o campo de chave de API.`);
  }
  return errors;
}

export function createProviderBundle(
  config: ProviderConfig,
  credentials: ProviderCredentials | undefined,
  fetchImpl: FetchLike
): ProviderBundle {
  const errors = validateProviderConfig(config);
  if (errors.length > 0) throw new OuveError("invalid-input", errors.join(" "), { retryable: false });
  const preset = presetFor(config.protocol);
  const apiKey = credentials?.apiKey.trim() ?? "";
  const local = (config.baseUrl ?? "").includes("localhost") || (config.baseUrl ?? "").includes("127.0.0.1");
  if (!apiKey && !local) throw new OuveError("auth", "Chave de API não configurada para este provedor.", { retryable: false });

  const baseUrl = (config.baseUrl?.trim() || preset.defaultBaseUrl).replace(/\/+$/, "");
  const common = {
    id: config.id,
    baseUrl,
    apiKey,
    fetch: fetchImpl,
    timeoutMs: config.timeoutMs ?? 120_000,
    retries: config.maxRetries ?? 2
  };
  const wants = (task: "transcription" | "analysis" | "report") => config.enabledTasks.includes(task);
  const wantsText = wants("analysis") || wants("report");

  switch (config.protocol) {
    case "gemini": {
      const base: Omit<GeminiOptions, "model" | "capabilities"> = common;
      const bundle: ProviderBundle = {
        config,
        testConnection: (signal) =>
          safeTest(() => testGeminiConnection({ ...base, model: config.model, capabilities: preset.completion }, signal))
      };
      if (wants("transcription") && preset.transcription) {
        bundle.transcription = new GeminiTranscription(
          { ...base, model: config.transcriptionModel || config.model, capabilities: preset.transcription },
          config.model
        );
      }
      if (wantsText) bundle.completion = new GeminiCompletion({ ...base, model: config.model, capabilities: preset.completion });
      return bundle;
    }
    case "anthropic": {
      const options: AnthropicOptions = { ...common, model: config.model, capabilities: preset.completion };
      return {
        config,
        ...(wantsText ? { completion: new AnthropicCompletion(options) } : {}),
        testConnection: (signal) => safeTest(() => testAnthropicConnection(options, signal))
      };
    }
    default: {
      const base: Omit<OpenAiStyleOptions, "model" | "capabilities"> = {
        ...common,
        providerName: config.displayName || preset.displayName,
        ...(config.extraHeaders ? { extraHeaders: config.extraHeaders } : {})
      };
      const bundle: ProviderBundle = {
        config,
        testConnection: (signal) =>
          safeTest(() =>
            // Servidores só de transcrição (ex.: whisper.cpp) não têm /models: basta o servidor responder.
            wantsText
              ? testOpenAiConnection({ ...base, model: config.model, capabilities: preset.completion }, signal)
              : testServerReachable(config.baseUrl ?? "", base.providerName, fetchImpl, signal)
          )
      };
      if (wants("transcription") && preset.transcription) {
        bundle.transcription = new OpenAiTranscription({
          ...base,
          model: config.transcriptionModel || config.model,
          capabilities: preset.transcription
        });
      }
      if (wantsText) bundle.completion = new OpenAiCompletion({ ...base, model: config.model, capabilities: preset.completion });
      return bundle;
    }
  }
}

async function testServerReachable(
  baseUrl: string,
  providerName: string,
  fetchImpl: FetchLike,
  signal?: AbortSignal
): Promise<ConnectionTestResult> {
  const started = Date.now();
  const res = await fetchImpl(new URL("/", baseUrl).toString(), { method: "GET", signal: signal ?? AbortSignal.timeout(5000) });
  if (res.status >= 500)
    throw new OuveError("provider-unavailable", `${providerName}: o servidor respondeu com erro (HTTP ${res.status}).`);
  return { ok: true, latencyMs: Date.now() - started, message: `Conexão estabelecida com ${providerName}.` };
}

async function safeTest(run: () => Promise<ConnectionTestResult>): Promise<ConnectionTestResult> {
  const started = Date.now();
  try {
    return await run();
  } catch (error) {
    const e = toOuveError(error);
    return { ok: false, latencyMs: Date.now() - started, message: e.message };
  }
}
