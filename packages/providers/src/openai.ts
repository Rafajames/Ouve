import type {
  CompletionProvider,
  CompletionRequest,
  ConnectionTestResult,
  ProviderCapabilities,
  ProviderSegment,
  TranscriptionProvider,
  TranscriptionRequest,
  TranscriptionResult
} from "@ouve/core";
import { OuveError } from "@ouve/shared";
import { joinUrl, readJson, sendRequest, type FetchLike, type HttpOptions } from "./http.js";

export interface OpenAiStyleOptions {
  id: string;
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  fetch: FetchLike;
  timeoutMs: number;
  retries: number;
  extraHeaders?: Record<string, string>;
  capabilities: ProviderCapabilities;
  /** Envia response_format json_object. */
  jsonMode?: boolean;
}

function headers(options: OpenAiStyleOptions): Record<string, string> {
  return { ...(options.extraHeaders ?? {}), Authorization: `Bearer ${options.apiKey}` };
}

function http(options: OpenAiStyleOptions, signal?: AbortSignal): HttpOptions {
  return {
    fetch: options.fetch,
    providerName: options.providerName,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
    ...(signal ? { signal } : {})
  };
}

interface VerboseSegment {
  start: number;
  end: number;
  text: string;
  avg_logprob?: number;
  speaker?: string;
}

export function responseFormatFor(model: string): "verbose_json" | "diarized_json" | "json" {
  if (model.includes("diarize")) return "diarized_json";
  if (model.startsWith("whisper")) return "verbose_json";
  return "json";
}

/** Normaliza as variações de resposta de /audio/transcriptions. */
export function parseOpenAiTranscription(body: unknown, durationMs: number): TranscriptionResult {
  const data = body as { text?: string; language?: string; segments?: VerboseSegment[] };
  let segments: ProviderSegment[];
  if (Array.isArray(data.segments) && data.segments.length > 0) {
    segments = data.segments.map((s) => {
      const out: ProviderSegment = { startMs: s.start * 1000, endMs: s.end * 1000, text: String(s.text ?? "") };
      if (s.speaker !== undefined) out.speakerLabel = String(s.speaker);
      if (typeof s.avg_logprob === "number") out.confidence = Math.max(0, Math.min(1, Math.exp(s.avg_logprob)));
      return out;
    });
  } else if (typeof data.text === "string") {
    segments = data.text.trim() ? [{ startMs: 0, endMs: durationMs, text: data.text }] : [];
  } else {
    throw new OuveError("invalid-response", "Resposta de transcrição sem texto.", { retryable: false });
  }
  return data.language ? { segments, detectedLanguage: data.language } : { segments };
}

export class OpenAiTranscription implements TranscriptionProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;

  constructor(private readonly options: OpenAiStyleOptions) {
    this.id = options.id;
    this.capabilities = options.capabilities;
  }

  async transcribe(request: TranscriptionRequest, signal?: AbortSignal): Promise<TranscriptionResult> {
    const format = responseFormatFor(this.options.model);
    const form = new FormData();
    const extension = request.mimeType.includes("wav") ? "wav" : (request.mimeType.split("/")[1] ?? "bin");
    form.append("file", request.audio, `bloco.${extension}`);
    form.append("model", this.options.model);
    form.append("response_format", format);
    if (request.language) form.append("language", request.language.split("-")[0] ?? request.language);
    if (format === "diarized_json") form.append("chunking_strategy", "auto");
    else if (request.previousText) form.append("prompt", request.previousText.slice(-800));
    if (format === "verbose_json") form.append("timestamp_granularities[]", "segment");

    const response = await sendRequest(
      joinUrl(this.options.baseUrl, "audio/transcriptions"),
      { method: "POST", headers: headers(this.options), body: form },
      http(this.options, signal)
    );
    return parseOpenAiTranscription(await readJson(response, this.options.providerName), request.durationMs);
  }
}

export class OpenAiCompletion implements CompletionProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  private jsonSupported: boolean;

  constructor(private readonly options: OpenAiStyleOptions) {
    this.id = options.id;
    this.capabilities = options.capabilities;
    this.jsonSupported = options.jsonMode ?? true;
  }

  async complete(request: CompletionRequest, signal?: AbortSignal): Promise<string> {
    const send = (useJson: boolean) =>
      sendRequest(
        joinUrl(this.options.baseUrl, "chat/completions"),
        {
          method: "POST",
          headers: { ...headers(this.options), "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.options.model,
            messages: request.messages,
            ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
            ...(request.maxOutputTokens ? { max_tokens: request.maxOutputTokens } : {}),
            ...(useJson ? { response_format: { type: "json_object" } } : {})
          })
        },
        http(this.options, signal)
      );

    let response: Response;
    const wantJson = request.json && this.jsonSupported;
    try {
      response = await send(wantJson);
    } catch (error) {
      // Servidores compatíveis às vezes recusam response_format: tenta uma vez sem ele.
      if (wantJson && error instanceof OuveError && error.status === 400) {
        this.jsonSupported = false;
        response = await send(false);
      } else throw error;
    }
    const body = await readJson<{ choices?: Array<{ message?: { content?: string } }> }>(response, this.options.providerName);
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string")
      throw new OuveError("invalid-response", `${this.options.providerName}: resposta sem conteúdo.`, { retryable: false });
    return content;
  }
}

export async function testOpenAiConnection(options: OpenAiStyleOptions, signal?: AbortSignal): Promise<ConnectionTestResult> {
  const started = Date.now();
  const response = await sendRequest(
    joinUrl(options.baseUrl, "models"),
    { method: "GET", headers: headers(options) },
    { ...http(options, signal), retries: 0 }
  );
  const body = await readJson<{ data?: Array<{ id?: string }> }>(response, options.providerName);
  const models = (body.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string");
  return { ok: true, latencyMs: Date.now() - started, message: `Conexão estabelecida com ${options.providerName}.`, models };
}
