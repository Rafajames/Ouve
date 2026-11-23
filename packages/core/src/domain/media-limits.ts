/**
 * Limites e formatos de importação. Valores iniciais de referência (D-044, provisória):
 * 2 GB e 4 horas. São configuráveis e não devem ser anunciados como garantidos.
 */
export interface MediaLimits {
  maxFileBytes: number;
  maxDurationMs: number;
}

export const DEFAULT_MEDIA_LIMITS: MediaLimits = {
  maxFileBytes: 2 * 1024 * 1024 * 1024,
  maxDurationMs: 4 * 60 * 60 * 1000
};

export const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "flac"] as const;
/** Vídeo é aceito somente como contêiner para extrair o áudio. */
export const VIDEO_EXTENSIONS = ["mp4", "mov", "mkv", "webm"] as const;

export type MediaKind = "audio" | "video";

export interface MediaFileInfo {
  name: string;
  sizeBytes: number;
  durationMs?: number;
}

export type MediaValidation =
  | { ok: true; kind: MediaKind; extension: string }
  | { ok: false; code: "unsupported-format" | "file-too-large" | "duration-exceeded" | "empty-file"; message: string };

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function validateMediaFile(file: MediaFileInfo, limits: MediaLimits = DEFAULT_MEDIA_LIMITS): MediaValidation {
  const extension = extensionOf(file.name);
  const kind: MediaKind | undefined = (AUDIO_EXTENSIONS as readonly string[]).includes(extension)
    ? "audio"
    : (VIDEO_EXTENSIONS as readonly string[]).includes(extension)
      ? "video"
      : undefined;
  if (!kind) {
    return {
      ok: false,
      code: "unsupported-format",
      message: `Formato não suportado (.${extension || "sem extensão"}). Aceitos: ${[...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS].join(", ")}.`
    };
  }
  if (file.sizeBytes <= 0) return { ok: false, code: "empty-file", message: "O arquivo está vazio." };
  if (file.sizeBytes > limits.maxFileBytes) {
    return { ok: false, code: "file-too-large", message: `Arquivo maior que o limite configurado (${formatBytes(limits.maxFileBytes)}).` };
  }
  if (file.durationMs !== undefined && file.durationMs > limits.maxDurationMs) {
    return {
      ok: false,
      code: "duration-exceeded",
      message: `Duração acima do limite configurado (${Math.round(limits.maxDurationMs / 3_600_000)} h).`
    };
  }
  return { ok: true, kind, extension };
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${units[unit]}`;
}
