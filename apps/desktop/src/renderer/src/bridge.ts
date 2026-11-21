import type {
  CompletionProvider,
  CompletionRequest,
  ProviderCapabilities,
  TranscriptionProvider,
  TranscriptionRequest,
  TranscriptionResult
} from "@ouve/core";
import { OuveError, createId, type OuveErrorCode } from "@ouve/shared";
import type { IpcResult, OuveBridge } from "../../shared/ipc";

declare global {
  interface Window {
    ouve?: OuveBridge;
  }
}

export function bridge(): OuveBridge {
  if (!window.ouve) throw new OuveError("unsupported", "Ponte do aplicativo indisponível.");
  return window.ouve;
}

export function hasBridge(): boolean {
  return typeof window !== "undefined" && !!window.ouve;
}

/** Converte IpcResult em valor ou OuveError. */
export async function unwrap<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise;
  if (result.ok) return result.value;
  throw new OuveError(result.error.code as OuveErrorCode, result.error.message, { retryable: result.error.retryable });
}

const genericCaps: ProviderCapabilities = { tasks: [], streaming: false, diarization: false, segmentTimestamps: false, confidence: false };

function linkAbort(signal: AbortSignal | undefined, requestId: string): () => void {
  const onAbort = () => void bridge().ai.cancel(requestId);
  signal?.addEventListener("abort", onAbort, { once: true });
  return () => signal?.removeEventListener("abort", onAbort);
}

/** Transcrição executada no processo principal (a chave nunca chega aqui). */
export class IpcTranscriptionProvider implements TranscriptionProvider {
  readonly capabilities = genericCaps;
  constructor(readonly id: string) {}

  async transcribe(request: TranscriptionRequest, signal?: AbortSignal): Promise<TranscriptionResult> {
    const requestId = createId("req");
    const unlink = linkAbort(signal, requestId);
    try {
      const audio = await request.audio.arrayBuffer();
      const value = await unwrap(
        bridge().ai.transcribe({
          requestId,
          providerId: this.id,
          audio,
          mimeType: request.mimeType,
          durationMs: request.durationMs,
          ...(request.language ? { language: request.language } : {}),
          ...(request.previousText ? { previousText: request.previousText } : {})
        })
      );
      return value.detectedLanguage ? { segments: value.segments, detectedLanguage: value.detectedLanguage } : { segments: value.segments };
    } finally {
      unlink();
    }
  }
}

export class IpcCompletionProvider implements CompletionProvider {
  readonly capabilities = genericCaps;
  constructor(readonly id: string) {}

  async complete(request: CompletionRequest, signal?: AbortSignal): Promise<string> {
    const requestId = createId("req");
    const unlink = linkAbort(signal, requestId);
    try {
      return await unwrap(bridge().ai.complete({ requestId, providerId: this.id, request }));
    } finally {
      unlink();
    }
  }
}
