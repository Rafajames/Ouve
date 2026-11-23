/**
 * Códigos de erro estáveis do Ouve. Mensagens destinadas ao usuário ficam em
 * pt-BR; nunca incluem conteúdo de reunião nem segredos.
 */
export type OuveErrorCode =
  | "cancelled"
  | "timeout"
  | "network"
  | "auth"
  | "rate-limit"
  | "provider-unavailable"
  | "provider-error"
  | "unsupported"
  | "invalid-input"
  | "invalid-response"
  | "no-audio"
  | "source-ended"
  | "permission-denied"
  | "file-too-large"
  | "duration-exceeded"
  | "internal";

export class OuveError extends Error {
  readonly code: OuveErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  /** Espera sugerida pelo provedor (cabeçalho Retry-After), em ms. */
  retryAfterMs?: number;

  constructor(code: OuveErrorCode, message: string, options: { retryable?: boolean; status?: number; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "OuveError";
    this.code = code;
    this.retryable =
      options.retryable ?? (code === "network" || code === "rate-limit" || code === "provider-unavailable" || code === "timeout");
    if (options.status !== undefined) this.status = options.status;
  }
}

export function isOuveError(error: unknown): error is OuveError {
  return error instanceof OuveError;
}

/** Converte qualquer erro em OuveError sem vazar detalhes sensíveis. */
export function toOuveError(error: unknown): OuveError {
  if (error instanceof OuveError) return error;
  if (error instanceof DOMException || (error instanceof Error && error.name === "AbortError")) {
    return new OuveError("cancelled", "Operação cancelada.");
  }
  if (error instanceof TypeError) {
    return new OuveError("network", "Falha de rede ao contatar o serviço.", { cause: error });
  }
  return new OuveError("internal", "Erro inesperado.", { cause: error });
}

/** Mapeia um status HTTP para um código de erro do Ouve. */
export function errorFromHttpStatus(status: number, providerName: string): OuveError {
  if (status === 401 || status === 403) {
    return new OuveError("auth", `${providerName}: credencial recusada (HTTP ${status}).`, { status, retryable: false });
  }
  if (status === 429) {
    return new OuveError("rate-limit", `${providerName}: limite de requisições atingido (HTTP 429).`, { status });
  }
  if (status === 408) return new OuveError("timeout", `${providerName}: tempo esgotado (HTTP 408).`, { status });
  if (status >= 500) {
    return new OuveError("provider-unavailable", `${providerName}: serviço indisponível (HTTP ${status}).`, { status });
  }
  if (status === 404) {
    return new OuveError("provider-error", `${providerName}: endpoint ou modelo não encontrado (HTTP 404).`, { status, retryable: false });
  }
  return new OuveError("provider-error", `${providerName}: requisição recusada (HTTP ${status}).`, { status, retryable: false });
}
