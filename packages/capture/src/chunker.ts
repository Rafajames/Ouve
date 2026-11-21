import { encodeWav, rms } from "./pcm.js";

export interface PcmChunk {
  index: number;
  /** Início relativo ao áudio capturado da sessão (pausas não contam). */
  offsetMs: number;
  durationMs: number;
  sampleRate: number;
  wav: Uint8Array;
  /** Bloco sem fala perceptível; o pipeline pode pular a transcrição. */
  silent: boolean;
  level: number;
}

export interface PcmChunkerOptions {
  sampleRate: number;
  chunkMs: number;
  /** RMS abaixo deste valor é considerado silêncio. */
  silenceThreshold?: number;
  onChunk: (chunk: PcmChunk) => void;
}

/**
 * Acumula PCM mono e emite blocos WAV de duração fixa. Emite sempre em ordem,
 * com índices sequenciais, para que a transcrição seja idempotente por índice.
 */
export class PcmChunker {
  private buffer: Float32Array[] = [];
  private buffered = 0;
  private index = 0;
  private emittedSamples = 0;
  private readonly samplesPerChunk: number;
  private readonly threshold: number;

  constructor(private readonly options: PcmChunkerOptions) {
    if (options.chunkMs < 1000) throw new Error("Blocos devem ter ao menos 1 segundo.");
    this.samplesPerChunk = Math.round((options.sampleRate * options.chunkMs) / 1000);
    this.threshold = options.silenceThreshold ?? 0.003;
  }

  push(samples: Float32Array): void {
    if (samples.length === 0) return;
    this.buffer.push(samples);
    this.buffered += samples.length;
    while (this.buffered >= this.samplesPerChunk) this.emit(this.samplesPerChunk);
  }

  /** Emite o restante (ao pausar/encerrar). Blocos menores que 300 ms são descartados. */
  flush(): void {
    const minimum = Math.round(this.options.sampleRate * 0.3);
    if (this.buffered >= minimum) this.emit(this.buffered);
    else {
      this.emittedSamples += this.buffered;
      this.buffer = [];
      this.buffered = 0;
    }
  }

  get capturedMs(): number {
    return ((this.emittedSamples + this.buffered) / this.options.sampleRate) * 1000;
  }

  private emit(count: number): void {
    const out = new Float32Array(count);
    let filled = 0;
    while (filled < count) {
      const head = this.buffer[0];
      if (!head) break;
      const take = Math.min(head.length, count - filled);
      out.set(head.subarray(0, take), filled);
      filled += take;
      if (take === head.length) this.buffer.shift();
      else this.buffer[0] = head.subarray(take);
    }
    this.buffered -= count;
    const level = rms(out);
    const chunk: PcmChunk = {
      index: this.index++,
      offsetMs: (this.emittedSamples / this.options.sampleRate) * 1000,
      durationMs: (count / this.options.sampleRate) * 1000,
      sampleRate: this.options.sampleRate,
      wav: encodeWav(out, this.options.sampleRate),
      silent: level < this.threshold,
      level
    };
    this.emittedSamples += count;
    this.options.onChunk(chunk);
  }
}

export interface ActivityMonitorOptions {
  /** Tempo contínuo sem sinal para alertar "sem áudio". */
  silenceAlertMs: number;
  threshold?: number;
  onChange: (state: "audio" | "no-audio") => void;
}

/** Detecta ausência prolongada de áudio para avisar o usuário. */
export class AudioActivityMonitor {
  private silentForMs = 0;
  private state: "unknown" | "audio" | "no-audio" = "unknown";
  private readonly threshold: number;

  constructor(private readonly options: ActivityMonitorOptions) {
    this.threshold = options.threshold ?? 0.003;
  }

  observe(level: number, durationMs: number): void {
    if (level >= this.threshold) {
      this.silentForMs = 0;
      this.set("audio");
    } else {
      this.silentForMs += durationMs;
      if (this.silentForMs >= this.options.silenceAlertMs) this.set("no-audio");
    }
  }

  reset(): void {
    this.silentForMs = 0;
    this.state = "unknown";
  }

  private set(next: "audio" | "no-audio"): void {
    if (this.state !== next) {
      this.state = next;
      this.options.onChange(next);
    }
  }
}
