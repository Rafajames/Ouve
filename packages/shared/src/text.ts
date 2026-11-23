/** Remove caracteres de controle (exceto quebra de linha e tabulação) e limita o tamanho. */
export function sanitizeText(value: string, maxLength = 100_000): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").normalize("NFC");
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/** Sanitiza rótulos curtos (nomes de falantes, provedores). */
export function sanitizeLabel(value: string, maxLength = 80): string {
  return sanitizeText(value, maxLength).replace(/\s+/g, " ").trim();
}

/** Formata milissegundos como HH:MM:SS. */
export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

let counter = 0;
/** Gera identificadores efêmeros (não criptográficos) para entidades de sessão. */
export function createId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${random}`;
}

/** Valida URL de endpoint: exige https, exceto localhost para servidores locais. */
export function validateEndpointUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Endereço do endpoint inválido.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("O endpoint deve usar HTTPS (HTTP só é aceito para localhost).");
  }
  if (url.username || url.password) throw new Error("Não inclua credenciais na URL do endpoint.");
  return url;
}
