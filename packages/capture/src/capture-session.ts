import { AudioActivityMonitor, PcmChunker, type PcmChunk } from "./chunker.js";
import { resampleLinear, rms } from "./pcm.js";
import type { MediaStreamLike } from "./sources.js";

/* Interfaces mínimas do Web Audio, para permitir testes com dublês. */
export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
  disconnect(): void;
}
export interface GainNodeLike extends AudioNodeLike {
  gain: { value: number };
}
export interface AudioBufferLike {
  getChannelData(channel: number): Float32Array;
}
export interface ScriptProcessorLike extends AudioNodeLike {
  onaudioprocess: ((event: { inputBuffer: AudioBufferLike }) => void) | null;
}
export interface AudioContextLike {
  readonly sampleRate: number;
  readonly destination: AudioNodeLike;
  createMediaStreamSource(stream: MediaStreamLike): AudioNodeLike;
  createGain(): GainNodeLike;
  createScriptProcessor(bufferSize: number, inputs: number, outputs: number): ScriptProcessorLike;
  close(): Promise<void>;
}

export type CaptureState = "capturing" | "paused" | "stopped";

export interface CaptureSessionOptions {
  createContext: () => AudioContextLike;
  source?: MediaStreamLike;
  microphone?: MediaStreamLike;
  /** Taxa de saída para transcrição. */
  targetSampleRate?: number;
  chunkMs?: number;
  silenceAlertMs?: number;
  /**
   * Reproduz o áudio da fonte localmente (necessário em tabCapture, que silencia a aba).
   * Não é gravação: apenas devolve o som ao usuário.
   */
  playbackSource?: boolean;
  onChunk: (chunk: PcmChunk) => void;
  onLevel?: (level: number) => void;
  onActivity?: (state: "audio" | "no-audio") => void;
  onSourceEnded?: (which: "source" | "microphone") => void;
  onStateChange?: (state: CaptureState) => void;
}

/**
 * Sessão de captura exclusivamente de áudio: mixa fonte e microfone, reamostra
 * para 16 kHz mono e entrega blocos WAV. Pausa não envia áudio; encerrar libera
 * todas as trilhas e o AudioContext.
 *
 * Usa ScriptProcessorNode por compatibilidade com páginas de extensão (CSP) e
 * Electron; migração para AudioWorklet está no backlog.
 */
export class AudioCaptureSession {
  private state: CaptureState = "capturing";
  private readonly context: AudioContextLike;
  private readonly chunker: PcmChunker;
  private readonly monitor: AudioActivityMonitor;
  private readonly nodes: AudioNodeLike[] = [];
  private readonly sourceGain?: GainNodeLike;
  private readonly micGain?: GainNodeLike;
  private readonly targetRate: number;

  constructor(private readonly options: CaptureSessionOptions) {
    if (!options.source && !options.microphone) throw new Error("Selecione ao menos uma fonte de áudio.");
    this.targetRate = options.targetSampleRate ?? 16_000;
    this.context = options.createContext();
    this.chunker = new PcmChunker({ sampleRate: this.targetRate, chunkMs: options.chunkMs ?? 20_000, onChunk: options.onChunk });
    this.monitor = new AudioActivityMonitor({
      silenceAlertMs: options.silenceAlertMs ?? 15_000,
      onChange: (s) => options.onActivity?.(s)
    });

    const mix = this.context.createGain();
    const processor = this.context.createScriptProcessor(4096, 1, 1);
    const mute = this.context.createGain();
    mute.gain.value = 0;
    this.nodes.push(mix, processor, mute);

    if (options.source) {
      const node = this.context.createMediaStreamSource(options.source);
      const gain = this.context.createGain();
      node.connect(gain);
      gain.connect(mix);
      if (options.playbackSource) node.connect(this.context.destination);
      this.sourceGain = gain;
      this.nodes.push(node, gain);
      this.watchEnded(options.source, "source");
    }
    if (options.microphone) {
      const node = this.context.createMediaStreamSource(options.microphone);
      const gain = this.context.createGain();
      node.connect(gain);
      gain.connect(mix);
      this.micGain = gain;
      this.nodes.push(node, gain);
      this.watchEnded(options.microphone, "microphone");
    }

    mix.connect(processor);
    processor.connect(mute);
    mute.connect(this.context.destination);
    processor.onaudioprocess = (event) => this.process(event.inputBuffer.getChannelData(0));
  }

  get currentState(): CaptureState {
    return this.state;
  }

  get capturedMs(): number {
    return this.chunker.capturedMs;
  }

  private watchEnded(stream: MediaStreamLike, which: "source" | "microphone"): void {
    for (const track of stream.getAudioTracks()) {
      track.addEventListener("ended", () => {
        if (this.state === "stopped") return;
        this.options.onSourceEnded?.(which);
        const remaining = which === "source" ? this.options.microphone : this.options.source;
        const alive = remaining?.getAudioTracks().some((t) => t.readyState !== "ended") ?? false;
        if (!alive) void this.stop();
      });
    }
  }

  private process(input: Float32Array): void {
    if (this.state !== "capturing") return;
    // Copia: o buffer do Web Audio é reutilizado entre chamadas.
    const copy = new Float32Array(input);
    const level = rms(copy);
    const durationMs = (copy.length / this.context.sampleRate) * 1000;
    this.options.onLevel?.(level);
    this.monitor.observe(level, durationMs);
    this.chunker.push(resampleLinear(copy, this.context.sampleRate, this.targetRate));
  }

  setSourceVolume(value: number): void {
    if (this.sourceGain) this.sourceGain.gain.value = clamp(value);
  }

  setMicrophoneVolume(value: number): void {
    if (this.micGain) this.micGain.gain.value = clamp(value);
  }

  /** Silencia/reativa o microfone sem encerrar a fonte. */
  setMicrophoneEnabled(enabled: boolean): void {
    for (const track of this.options.microphone?.getAudioTracks() ?? []) track.enabled = enabled;
  }

  pause(): void {
    if (this.state !== "capturing") return;
    this.state = "paused";
    this.chunker.flush();
    this.monitor.reset();
    this.options.onStateChange?.("paused");
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.state = "capturing";
    this.options.onStateChange?.("capturing");
  }

  async stop(): Promise<void> {
    if (this.state === "stopped") return;
    const wasCapturing = this.state === "capturing";
    this.state = "stopped";
    if (wasCapturing) this.chunker.flush();
    for (const node of this.nodes) {
      try {
        node.disconnect();
      } catch {
        /* nó já desconectado */
      }
    }
    for (const stream of [this.options.source, this.options.microphone]) {
      for (const track of stream?.getTracks() ?? []) track.stop();
    }
    await this.context.close().catch(() => undefined);
    this.options.onStateChange?.("stopped");
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(2, value));
}
