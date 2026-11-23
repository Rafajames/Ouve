import { OuveError, toOuveError } from "./errors.js";

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new OuveError("cancelled", "Operação cancelada.");
}

/** Aguarda `ms` respeitando cancelamento. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new OuveError("cancelled", "Operação cancelada."));
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new OuveError("cancelled", "Operação cancelada."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Cria um sinal que aborta quando o sinal externo abortar ou quando o tempo
 * limite expirar. `timedOut()` diferencia timeout de cancelamento do usuário.
 */
export function withTimeout(timeoutMs: number, outer?: AbortSignal): { signal: AbortSignal; timedOut: () => boolean; dispose: () => void } {
  const controller = new AbortController();
  let didTimeout = false;
  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (outer?.aborted) controller.abort();
  outer?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    timedOut: () => didTimeout,
    dispose: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onAbort);
    }
  };
}

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  /** Permite injetar atraso em testes. */
  delay?: (ms: number, signal?: AbortSignal) => Promise<void>;
  onRetry?: (attempt: number, error: unknown) => void;
}

/** Repete operações com backoff exponencial apenas para erros reexecutáveis. */
export async function retry<T>(operation: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const delay = options.delay ?? sleep;
  let attempt = 0;
  for (;;) {
    throwIfAborted(options.signal);
    try {
      return await operation(attempt);
    } catch (error) {
      const ouveError = toOuveError(error);
      if (!ouveError.retryable || attempt >= options.retries || options.signal?.aborted) throw ouveError;
      options.onRetry?.(attempt + 1, ouveError);
      // Limite de uso (comum em planos gratuitos): espera mais e respeita o Retry-After do provedor.
      const base = ouveError.code === "rate-limit" ? Math.max(options.baseDelayMs, 10_000) : options.baseDelayMs;
      const backoff = Math.min(base * 2 ** attempt, ouveError.code === "rate-limit" ? 60_000 : (options.maxDelayMs ?? 30_000));
      const wait = Math.max(backoff, Math.min(ouveError.retryAfterMs ?? 0, 120_000));
      await delay(wait, options.signal);
      attempt += 1;
    }
  }
}
