import type { CompletionRequest, ConnectionTestResult, ProviderConfig, TranscriptionResult } from "@ouve/core";
import {
  createProviderBundle,
  credentialRefFor,
  validateProviderConfig,
  type FetchLike,
  type ProviderBundle,
  type SecretStore
} from "@ouve/providers";
import { OuveError } from "@ouve/shared";
import type { ProviderSummary, SaveProviderInput } from "../shared/ipc.js";
import type { SettingsStore } from "./stores.js";

/**
 * Executa chamadas de IA no processo principal: as chaves ficam aqui e nunca
 * chegam ao renderer. Cada requisição tem id para cancelamento.
 */
export class ProviderService {
  private readonly inflight = new Map<string, AbortController>();

  constructor(
    private readonly settings: SettingsStore,
    private readonly secrets: SecretStore,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init)
  ) {}

  async list(): Promise<ProviderSummary[]> {
    const configs = await this.settings.listProviders();
    return Promise.all(configs.map(async (config) => ({ config, hasKey: !!(await this.secrets.get(credentialRefFor(config.id))) })));
  }

  async save(input: SaveProviderInput): Promise<ProviderSummary> {
    const errors = validateProviderConfig(input.config);
    if (errors.length) throw new OuveError("invalid-input", errors.join(" "), { retryable: false });
    const ref = credentialRefFor(input.config.id);
    const config: ProviderConfig = { ...input.config, credentialRef: ref };
    if (input.apiKey !== undefined) {
      const key = input.apiKey.trim();
      if (key) await this.secrets.set(ref, key);
      else await this.secrets.delete(ref);
    }
    const list = (await this.settings.listProviders()).filter((p) => p.id !== config.id);
    list.push(config);
    await this.settings.saveProviders(list);
    return { config, hasKey: !!(await this.secrets.get(ref)) };
  }

  async remove(id: string): Promise<void> {
    await this.secrets.delete(credentialRefFor(id));
    await this.settings.saveProviders((await this.settings.listProviders()).filter((p) => p.id !== id));
  }

  private async bundle(id: string): Promise<ProviderBundle> {
    const config = (await this.settings.listProviders()).find((p) => p.id === id);
    if (!config) throw new OuveError("invalid-input", "Provedor não configurado.", { retryable: false });
    const key = await this.secrets.get(credentialRefFor(id));
    return createProviderBundle(config, key ? { apiKey: key } : undefined, this.fetchImpl);
  }

  async test(id: string): Promise<ConnectionTestResult> {
    return (await this.bundle(id)).testConnection();
  }

  private track<T>(requestId: string, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    this.inflight.set(requestId, controller);
    return run(controller.signal).finally(() => this.inflight.delete(requestId));
  }

  async transcribe(
    requestId: string,
    providerId: string,
    request: { audio: Uint8Array; mimeType: string; durationMs: number; language?: string; previousText?: string }
  ): Promise<TranscriptionResult> {
    const bundle = await this.bundle(providerId);
    if (!bundle.transcription)
      throw new OuveError("unsupported", "Este provedor não está habilitado para transcrição.", { retryable: false });
    const transcription = bundle.transcription;
    return this.track(requestId, (signal) =>
      transcription.transcribe(
        {
          audio: new Blob([request.audio as BlobPart], { type: request.mimeType }),
          mimeType: request.mimeType,
          durationMs: request.durationMs,
          ...(request.language ? { language: request.language } : {}),
          ...(request.previousText ? { previousText: request.previousText } : {})
        },
        signal
      )
    );
  }

  async complete(requestId: string, providerId: string, request: CompletionRequest): Promise<string> {
    const bundle = await this.bundle(providerId);
    if (!bundle.completion) throw new OuveError("unsupported", "Este provedor não está habilitado para análise.", { retryable: false });
    const completion = bundle.completion;
    return this.track(requestId, (signal) => completion.complete(request, signal));
  }

  cancel(requestId: string): void {
    this.inflight.get(requestId)?.abort();
  }

  cancelAll(): void {
    for (const controller of this.inflight.values()) controller.abort();
  }
}
