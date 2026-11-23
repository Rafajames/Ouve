import type { CompletionRequest, ConnectionTestResult, ProviderConfig, TranscriptionResult } from "@ouve/core";
import {
  createProviderBundle,
  credentialRefFor,
  presetFor,
  runQuickSetup,
  validateProviderConfig,
  type FetchLike,
  type ProviderBundle,
  type SecretStore
} from "@ouve/providers";
import { OuveError } from "@ouve/shared";
import type { ProviderSummary, QuickSetupOutcome, SaveProviderInput } from "../shared/ipc.js";
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

  /**
   * Configuração rápida: identifica o provedor pela chave, testa, escolhe modelos,
   * salva e já seleciona o provedor para os serviços que ele oferece (D-065).
   */
  async quickSetup(apiKey: string): Promise<QuickSetupOutcome> {
    const id = `rapido-${Date.now().toString(36)}`;
    const result = await runQuickSetup(apiKey, this.fetchImpl, id);
    if (!result.ok || !result.config || !result.protocol) {
      return { ok: false, message: result.message, notes: result.notes, canTranscribe: false, canAnalyze: false };
    }
    // Uma nova chave do mesmo provedor substitui a configuração rápida anterior dele.
    for (const old of await this.settings.listProviders()) {
      if (old.protocol === result.protocol && old.id.startsWith("rapido-")) await this.remove(old.id);
    }
    await this.save({ config: result.config, apiKey });
    const settings = await this.settings.getSettings();
    if (result.canTranscribe) settings.transcriptionProviderId = id;
    if (result.canAnalyze) settings.analysisProviderId = id;
    await this.settings.saveSettings(settings);
    return {
      ok: true,
      message: result.message,
      notes: result.notes,
      providerName: presetFor(result.protocol).displayName,
      canTranscribe: result.canTranscribe,
      canAnalyze: result.canAnalyze
    };
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
