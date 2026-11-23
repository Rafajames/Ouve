import type { CompletionProvider, CompletionRequest, ConnectionTestResult, ProviderCapabilities } from "@ouve/core";
import { OuveError } from "@ouve/shared";
import { joinUrl, readJson, sendRequest, type FetchLike, type HttpOptions } from "./http.js";

export interface AnthropicOptions {
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  fetch: FetchLike;
  timeoutMs: number;
  retries: number;
  capabilities: ProviderCapabilities;
}

const NAME = "Anthropic Claude";
const VERSION = "2023-06-01";

function headers(options: AnthropicOptions): Record<string, string> {
  return {
    "x-api-key": options.apiKey,
    "anthropic-version": VERSION,
    "content-type": "application/json",
    // Necessário quando a chamada parte de uma página de extensão (BYOK do próprio usuário).
    "anthropic-dangerous-direct-browser-access": "true"
  };
}

function http(options: AnthropicOptions, signal?: AbortSignal): HttpOptions {
  return {
    fetch: options.fetch,
    providerName: NAME,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
    ...(signal ? { signal } : {})
  };
}

export class AnthropicCompletion implements CompletionProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;

  constructor(private readonly options: AnthropicOptions) {
    this.id = options.id;
    this.capabilities = options.capabilities;
  }

  async complete(request: CompletionRequest, signal?: AbortSignal): Promise<string> {
    const system = request.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const jsonHint = request.json ? "\n\nResponda somente com um objeto JSON válido, sem texto antes ou depois." : "";
    const response = await sendRequest(
      joinUrl(this.options.baseUrl, "messages"),
      {
        method: "POST",
        headers: headers(this.options),
        body: JSON.stringify({
          model: this.options.model,
          max_tokens: request.maxOutputTokens ?? 8000,
          ...(system || jsonHint ? { system: system + jsonHint } : {}),
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          messages: request.messages.filter((m) => m.role === "user").map((m) => ({ role: "user", content: m.content }))
        })
      },
      http(this.options, signal)
    );
    const body = await readJson<{ content?: Array<{ type?: string; text?: string }> }>(response, NAME);
    const text = body.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
    if (!text) throw new OuveError("invalid-response", `${NAME}: resposta sem conteúdo.`, { retryable: false });
    return text;
  }
}

export async function testAnthropicConnection(options: AnthropicOptions, signal?: AbortSignal): Promise<ConnectionTestResult> {
  const started = Date.now();
  const response = await sendRequest(
    joinUrl(options.baseUrl, "models"),
    { method: "GET", headers: headers(options) },
    { ...http(options, signal), retries: 0 }
  );
  const body = await readJson<{ data?: Array<{ id?: string }> }>(response, NAME);
  const models = (body.data ?? []).map((m) => m.id).filter((m): m is string => !!m);
  return { ok: true, latencyMs: Date.now() - started, message: `Conexão estabelecida com ${NAME}.`, models };
}
