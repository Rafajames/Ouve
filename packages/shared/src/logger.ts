/**
 * Logger com redação. Regras: nunca registrar áudio, transcrições, relatórios
 * ou segredos. Campos com nomes sensíveis são substituídos e padrões de chave
 * conhecidos são mascarados em qualquer string.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

const SENSITIVE_FIELD = /(key|token|secret|password|authorization|credential|audio|transcript|text|content|report|prompt|payload|data)/i;

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{8,}/g, // OpenAI / Anthropic (sk-ant-...)
  /xai-[A-Za-z0-9_-]{8,}/g,
  /AIza[0-9A-Za-z_-]{20,}/g, // Google
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /([?&](?:key|api_key|token)=)[^&\s]+/gi
];

export function redactString(value: string): string {
  let out = value;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match, prefix: unknown) =>
      typeof prefix === "string" && match.startsWith(prefix) ? `${prefix}[REDIGIDO]` : "[REDIGIDO]"
    );
  }
  return out;
}

export function redactFields(fields: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(fields)) {
    if (SENSITIVE_FIELD.test(name)) {
      result[name] = "[REDIGIDO]";
    } else if (typeof value === "string") {
      result[name] = redactString(value);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
      result[name] = value;
    } else {
      result[name] = "[omitido]";
    }
  }
  return result;
}

export interface LogSink {
  (level: LogLevel, message: string, fields: Record<string, unknown>): void;
}

const consoleSink: LogSink = (level, message, fields) => {
  const line = Object.keys(fields).length > 0 ? [message, fields] : [message];
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](...line);
};

export function createLogger(scope: string, sink: LogSink = consoleSink): Logger {
  const emit =
    (level: LogLevel) =>
    (message: string, fields: Record<string, unknown> = {}) =>
      sink(level, `[${scope}] ${redactString(message)}`, redactFields(fields));
  return { debug: emit("debug"), info: emit("info"), warn: emit("warn"), error: emit("error") };
}
