import { open, type FileHandle } from "node:fs/promises";

/**
 * Separação de vozes local (D-087): sherpa-onnx (Apache-2.0) com o modelo de
 * segmentação pyannote 3.0 (MIT) embutido no instalador e um modelo de "impressão
 * de voz" baixado sob pedido, conforme o perfil do computador. Roda offline.
 */
export interface DiarizationOptions {
  segmentationModel: string;
  embeddingModel: string;
  /** Número de pessoas, se o usuário souber (melhora bastante o resultado). 0 = automático. */
  speakers: number;
  threads: number;
}

/** Limiar de agrupamento quando o número de pessoas é desconhecido (maior = menos pessoas). */
export const DEFAULT_CLUSTER_THRESHOLD = 0.9;

export function diarizationArgs(wavPath: string, o: DiarizationOptions): string[] {
  const threads = String(Math.max(1, Math.floor(o.threads)));
  return [
    `--segmentation.pyannote-model=${o.segmentationModel}`,
    `--segmentation.num-threads=${threads}`,
    `--embedding.model=${o.embeddingModel}`,
    `--embedding.num-threads=${threads}`,
    o.speakers > 0 ? `--clustering.num-clusters=${Math.floor(o.speakers)}` : `--clustering.cluster-threshold=${DEFAULT_CLUSTER_THRESHOLD}`,
    wavPath
  ];
}

/** Lê "progress 42.50%" do stderr do sherpa-onnx (último valor do pedaço). */
export function parseProgress(chunk: string): number | undefined {
  const all = [...chunk.matchAll(/progress\s+(\d+(?:\.\d+)?)%/g)];
  const last = all[all.length - 1];
  return last ? Math.min(100, Math.floor(Number(last[1]))) : undefined;
}

/** Cabeçalho WAV PCM 16 bits mono. */
export function wavHeader(dataBytes: number, sampleRate = 16_000): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "ascii");
  h.writeUInt32LE(36 + dataBytes, 4);
  h.write("WAVE", 8, "ascii");
  h.write("fmt ", 12, "ascii");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36, "ascii");
  h.writeUInt32LE(dataBytes, 40);
  return h;
}

/** Extrai os bytes PCM de um WAV PCM 16 kHz mono 16 bits (os blocos da captura ao vivo). */
export function wavPcm(wav: Uint8Array): Uint8Array {
  const buf = Buffer.from(wav.buffer, wav.byteOffset, wav.byteLength);
  if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE")
    throw new Error("Bloco de áudio inválido.");
  let pos = 12;
  let format: { channels: number; rate: number; bits: number } | undefined;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt ")
      format = { channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    if (id === "data") {
      if (!format || format.channels !== 1 || format.rate !== 16_000 || format.bits !== 16)
        throw new Error("O áudio precisa ser PCM 16 kHz mono.");
      return wav.subarray(body, Math.min(buf.length, body + size));
    }
    pos = body + size + (size % 2);
  }
  throw new Error("Bloco de áudio sem dados.");
}

/**
 * Grava em disco (temporário) o áudio da captura ao vivo, bloco a bloco e em ordem,
 * só para separar as vozes ao encerrar. Nada fica na memória; o arquivo é apagado no descarte.
 */
export class LiveAudioRecorder {
  private handle: FileHandle | undefined;
  private bytes = 0;
  private nextIndex = 0;
  private readonly pending = new Map<number, Uint8Array>();
  private queue: Promise<void> = Promise.resolve();

  constructor(readonly path: string) {}

  append(index: number, wav: Uint8Array): Promise<void> {
    if (index < this.nextIndex || this.pending.has(index)) return this.queue;
    this.pending.set(index, wavPcm(wav));
    this.queue = this.queue.then(() => this.flush());
    return this.queue;
  }

  private async flush(): Promise<void> {
    this.handle ??= await open(this.path, "w");
    if (this.bytes === 0) await this.handle.write(wavHeader(0), 0, 44, 0);
    let pcm = this.pending.get(this.nextIndex);
    while (pcm) {
      await this.handle.write(pcm, 0, pcm.length, 44 + this.bytes);
      this.bytes += pcm.length;
      this.pending.delete(this.nextIndex);
      this.nextIndex++;
      pcm = this.pending.get(this.nextIndex);
    }
  }

  /** Fecha o arquivo com o cabeçalho certo e devolve a duração (ms). */
  async finish(): Promise<number> {
    await this.queue;
    if (!this.handle) return 0;
    await this.handle.write(wavHeader(this.bytes), 0, 44, 0);
    await this.handle.close();
    this.handle = undefined;
    return Math.round((this.bytes / 32_000) * 1000);
  }

  async close(): Promise<void> {
    await this.queue.catch(() => undefined);
    await this.handle?.close().catch(() => undefined);
    this.handle = undefined;
  }
}
