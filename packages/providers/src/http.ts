import { OuveError, errorFromHttpStatus, retry, toOuveError, withTimeout } from "@ouve/shared";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpOptions {
  fetch: FetchLike;
  providerName: string;
  timeoutMs: number;
  retries: number;
  signal?: AbortSignal;
  /** Injetável em testes. */
  delay?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/** Executa uma requisição com timeout, cancelamento, mapeamento de erros e novas tentativas. */
export async function sendRequest(url: string, init: RequestInit, options: HttpOptions): Promise<Response> {
  return retry(
    async () => {
      const timer = withTimeout(options.timeoutMs, options.signal);
      try {
        const response = await options.fetch(url, { ...init, signal: timer.signal });
        if (!response.ok) {
          // Corpo de erro não é registrado: pode ecoar conteúdo enviado.
          await response.body?.cancel().catch(() => undefined);
          const error = errorFromHttpStatus(response.status, options.providerName);
          const retryAfter = Number(response.headers.get("retry-after"));
          if (Number.isFinite(retryAfter) && retryAfter > 0) error.retryAfterMs = retryAfter * 1000;
          throw error;
        }
        return response;
      } catch (error) {
        if (timer.timedOut()) throw new OuveError("timeout", `${options.providerName}: tempo limite excedido.`);
        if (options.signal?.aborted) throw new OuveError("cancelled", "Operação cancelada.");
        throw toOuveError(error);
      } finally {
        timer.dispose();
      }
    },
    {
      retries: options.retries,
      baseDelayMs: 1000,
      maxDelayMs: 20_000,
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.delay ? { delay: options.delay } : {})
    }
  );
}

export async function readJson<T>(response: Response, providerName: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new OuveError("invalid-response", `${providerName}: resposta inválida (JSON esperado).`, { retryable: false });
  }
}

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/** Limita a taxa de requisições por provedor (intervalo mínimo entre envios). */
export class RateLimiter {
  private next = 0;
  constructor(
    private readonly minIntervalMs: number,
    private readonly now: () => number = Date.now,
    private readonly wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
  ) {}

  async acquire(): Promise<void> {
    const current = this.now();
    const slot = Math.max(current, this.next);
    this.next = slot + this.minIntervalMs;
    if (slot > current) await this.wait(slot - current);
  }
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(binary);
}
