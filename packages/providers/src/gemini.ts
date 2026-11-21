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
import { joinUrl, readJson, sendRequest, toBase64, type FetchLike, type HttpOptions } from "./http.js";

export interface GeminiOptions {
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  fetch: FetchLike;
  timeoutMs: number;
  retries: number;
  capabilities: ProviderCapabilities;
}

const NAME = "Google Gemini";

function http(options: GeminiOptions, signal?: AbortSignal): HttpOptions {
  return {
    fetch: options.fetch,
    providerName: NAME,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
    ...(signal ? { signal } : {})
  };
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
}

function extractText(body: GeminiResponse): string {
  if (body.promptFeedback?.blockReason) {
    throw new OuveError("provider-error", `${NAME}: conteúdo bloqueado pelo provedor (${body.promptFeedback.blockReason}).`, {
      retryable: false
    });
  }
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (text === undefined) throw new OuveError("invalid-response", `${NAME}: resposta sem conteúdo.`, { retryable: false });
  return text;
}

async function generate(options: GeminiOptions, payload: unknown, signal?: AbortSignal): Promise<string> {
  const url = joinUrl(options.baseUrl, `models/${encodeURIComponent(options.model)}:generateContent`);
  const response = await sendRequest(
    url,
    { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": options.apiKey }, body: JSON.stringify(payload) },
    http(options, signal)
  );
  return extractText(await readJson<GeminiResponse>(response, NAME));
}

const TRANSCRIBE_INSTRUCTION = `Transcreva fielmente o áudio anexado.
Regras:
- Não resuma, não traduza, não corrija o conteúdo falado.
- Identifique trocas de falante com rótulos neutros "S1", "S2"... Nunca invente nomes.
- Responda SOMENTE com JSON: {"segments":[{"start":segundos,"end":segundos,"speaker":"S1","text":"..."}]}
- Se não houver fala, responda {"segments":[]}.`;

/** Converte resposta do modelo em segmentos; timestamps são estimados e limitados à duração do bloco. */
export function parseGeminiSegments(raw: string, durationMs: number): ProviderSegment[] {
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let data: { segments?: Array<{ start?: unknown; end?: unknown; speaker?: unknown; text?: unknown }> };
  try {
    data = JSON.parse(json) as typeof data;
  } catch {
    throw new OuveError("invalid-response", `${NAME}: transcrição em formato inesperado.`, { retryable: true });
  }
  const clamp = (v: unknown) => Math.max(0, Math.min(durationMs, Number(v) * 1000 || 0));
  return (data.segments ?? [])
    .filter((s) => typeof s.text === "string" && s.text.trim())
    .map((s) => {
      const startMs = clamp(s.start);
      const segment: ProviderSegment = { startMs, endMs: Math.max(startMs, clamp(s.end)), text: String(s.text) };
      if (typeof s.speaker === "string" && s.speaker) segment.speakerLabel = s.speaker;
      return segment;
    });
}

export class GeminiTranscription implements TranscriptionProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;

  constructor(private readonly options: GeminiOptions) {
    this.id = options.id;
    this.capabilities = options.capabilities;
  }

  async transcribe(request: TranscriptionRequest, signal?: AbortSignal): Promise<TranscriptionResult> {
    const bytes = new Uint8Array(await request.audio.arrayBuffer());
    const language = request.language ? `Idioma esperado: ${request.language}.` : "Detecte o idioma.";
    const raw = await generate(
      this.options,
      {
        contents: [
          {
            role: "user",
            parts: [
              { text: `${TRANSCRIBE_INSTRUCTION}\n${language}` },
              { inline_data: { mime_type: request.mimeType, data: toBase64(bytes) } }
            ]
          }
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0 }
      },
      signal
    );
    return { segments: parseGeminiSegments(raw, request.durationMs) };
  }
}

export class GeminiCompletion implements CompletionProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;

  constructor(private readonly options: GeminiOptions) {
    this.id = options.id;
    this.capabilities = options.capabilities;
  }

  complete(request: CompletionRequest, signal?: AbortSignal): Promise<string> {
    const system = request.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const user = request.messages.filter((m) => m.role === "user").map((m) => ({ role: "user", parts: [{ text: m.content }] }));
    return generate(
      this.options,
      {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: user,
        generationConfig: {
          ...(request.json ? { responseMimeType: "application/json" } : {}),
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.maxOutputTokens ? { maxOutputTokens: request.maxOutputTokens } : {})
        }
      },
      signal
    );
  }
}

export async function testGeminiConnection(options: GeminiOptions, signal?: AbortSignal): Promise<ConnectionTestResult> {
  const started = Date.now();
  const response = await sendRequest(
    joinUrl(options.baseUrl, "models"),
    { method: "GET", headers: { "x-goog-api-key": options.apiKey } },
    { ...http(options, signal), retries: 0 }
  );
  const body = await readJson<{ models?: Array<{ name?: string }> }>(response, NAME);
  const models = (body.models ?? []).map((m) => m.name?.replace(/^models\//, "")).filter((m): m is string => !!m);
  return { ok: true, latencyMs: Date.now() - started, message: `Conexão estabelecida com ${NAME}.`, models };
}
