import { encodeWav } from "./pcm.js";
import { OuveError } from "@ouve/shared";
import { validateMediaFile } from "@ouve/core";

/**
 * Importação na extensão: decodifica o áudio no navegador (vídeo usado só como
 * contêiner) e divide em blocos WAV 16 kHz. Diferente do desktop, o arquivo é
 * decodificado inteiro na memória; por isso o limite é menor e configurável.
 */
export const EXTENSION_IMPORT_LIMITS = { maxFileBytes: 300 * 1024 * 1024, maxDurationMs: 2 * 60 * 60 * 1000 };

export interface DecodedChunk {
  index: number;
  offsetMs: number;
  durationMs: number;
  wav: Uint8Array;
}

export interface DecodeContextFactory {
  (sampleRate: number): {
    decodeAudioData(
      data: ArrayBuffer
    ): Promise<{ numberOfChannels: number; length: number; sampleRate: number; getChannelData(c: number): Float32Array }>;
  };
}

const defaultFactory: DecodeContextFactory = (rate) => new OfflineAudioContext(1, rate, rate);

export interface DecodedFile {
  durationMs: number;
  count: number;
  /** Codifica o bloco sob demanda para não manter todos os WAV na memória. */
  chunk(index: number): DecodedChunk;
}

export async function decodeFile(
  file: { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> },
  chunkSeconds = 120,
  factory = defaultFactory
): Promise<DecodedFile> {
  const check = validateMediaFile({ name: file.name, sizeBytes: file.size }, EXTENSION_IMPORT_LIMITS);
  if (!check.ok)
    throw new OuveError(
      "invalid-input",
      `${check.message} Na extensão, o limite é 300 MB; use o aplicativo desktop para arquivos maiores.`,
      { retryable: false }
    );
  const rate = 16_000;
  let buffer;
  try {
    buffer = await factory(rate).decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new OuveError("invalid-input", "O navegador não conseguiu decodificar o áudio deste arquivo. Tente o aplicativo desktop.", {
      retryable: false
    });
  }
  const durationMs = (buffer.length / buffer.sampleRate) * 1000;
  if (durationMs > EXTENSION_IMPORT_LIMITS.maxDurationMs)
    throw new OuveError("duration-exceeded", "Duração acima de 2 h na extensão; use o aplicativo desktop.", { retryable: false });
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < mono.length; i++) mono[i] = (mono[i] ?? 0) + (data[i] ?? 0) / buffer.numberOfChannels;
  }
  const sampleRate = buffer.sampleRate;
  const perChunk = chunkSeconds * sampleRate;
  return {
    durationMs,
    count: Math.ceil(mono.length / perChunk),
    chunk(index) {
      const start = index * perChunk;
      const slice = mono.subarray(start, Math.min(mono.length, start + perChunk));
      return {
        index,
        offsetMs: (start / sampleRate) * 1000,
        durationMs: (slice.length / sampleRate) * 1000,
        wav: encodeWav(slice, sampleRate)
      };
    }
  };
}
